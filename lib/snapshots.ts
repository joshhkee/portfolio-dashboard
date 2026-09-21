// Daily portfolio snapshots.
//
// The live ledger can answer "what is the portfolio worth NOW" but not
// "what was it worth last month" — replaying old transactions against
// today's prices gives today's value, not history. DailySnapshot rows
// freeze one value per calendar day so the value can be charted over
// time and time-weighted return / drawdown can be computed.
//
// Two writers:
//  - recordTodaySnapshot(): called opportunistically on dashboard page
//    loads — idempotent, at most one row per UTC calendar day.
//  - prisma/backfill-snapshots.ts: reconstructs past days from the
//    ledger replayed as-of each date + Yahoo historical closes.
//
// All values are in SGD so the series is directly chartable.

import { prisma } from "@/lib/prisma";
import {
  computeLedger,
  fromDbRows,
  type RawTransaction,
} from "@/lib/portfolio-engine";
import { fetchHistoricalCloses, toYahooSymbol, type HistoricalCloses } from "@/lib/prices";
import { convertCurrency, fetchFxRates, type FxRates } from "@/lib/fx";
import { drawdownSeries, type PerfPoint } from "@/lib/performance";

/** UTC-midnight Date for a "YYYY-MM-DD" string, and the reverse. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dayStart(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Replay the ledger as of the END of `key`, returning open positions in
 * the native currencies. Positions opened later or fully closed by that
 * day don't appear; holdings priced at that day's close are the
 * caller's job (it has the historical price maps). */
export function positionsAsOf(transactions: RawTransaction[], key: string) {
  const cutoff = dayStart(key).getTime() + 86399999; // end of that UTC day
  const upto = transactions.filter((t) => t.date.getTime() <= cutoff);
  const { openPositions } = computeLedger(upto);
  return openPositions;
}

/** Outlay (contributions) total recorded as of the end of `key`. */
export function outlayAsOf(contributions: { date: Date; amount: number }[], key: string): number {
  const cutoff = dayStart(key).getTime() + 86399999;
  return contributions
    .filter((c) => c.date.getTime() <= cutoff)
    .reduce((sum, c) => sum + c.amount, 0);
}

export interface DayValueInput {
  key: string;
  positions: { region: string; ticker: string; qty: number; avgCost: number }[];
  /** Historical close per (region, ticker) compound key, "YYYY-MM-DD" -> price. */
  historicalCloses: Record<string, HistoricalCloses>;
  rates: FxRates;
  /** Cash balance per currency as of that day. */
  cashByCurrency: Record<string, number>;
  costBasisSgd: number;
}

/** Compute one day's SGD figures from positions + that day's closes. */
export function dayValue(input: DayValueInput) {
  let holdingsSgd = 0;
  for (const p of input.positions) {
    // Walk back at most a few days to find the last trading day with a
    // close — markets close weekends/holidays, the snapshot series is
    // calendar-daily.
    let price: number | undefined;
    const closes = input.historicalCloses[`${p.region}::${p.ticker}`];
    if (closes) {
      const d = dayStart(input.key);
      for (let back = 0; back < 6 && price === undefined; back++) {
        price = closes[dayKey(d)];
        if (price === undefined) {
          d.setUTCDate(d.getUTCDate() - 1);
        }
      }
    }
    // No historical price at all: fall back to cost basis so the
    // position still counts (same policy as withLivePrices live view).
    const effective = price ?? p.avgCost;
    holdingsSgd += convertCurrency(p.qty * effective, p.region, "SGD", input.rates);
  }

  let cashSgd = 0;
  const regionOf: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };
  for (const [currency, balance] of Object.entries(input.cashByCurrency)) {
    cashSgd += convertCurrency(balance, regionOf[currency] ?? "SG", "SGD", input.rates);
  }

  return {
    holdingsValueSgd: holdingsSgd,
    cashValueSgd: cashSgd,
    totalValueSgd: holdingsSgd + cashSgd,
    costBasisSgd: input.costBasisSgd,
  };
}

/** Upsert today's snapshot. Idempotent per UTC day — recomputes and
 * overwrites today's row on every call so intraday movements are
 * reflected, and never touches past rows. Fails soft: snapshot
 * recording must never break a page load. */
export async function recordTodaySnapshot(): Promise<void> {
  try {
    const [rawTxns, contributions, cashRows] = await Promise.all([
      prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
      prisma.contribution.findMany({ select: { date: true, amount: true } }),
      prisma.cashBalance.findMany(),
    ]);
    const txns = fromDbRows(rawTxns);
    const key = dayKey(new Date());

    // Live (current) prices for open positions, not historical closes —
    // today's snapshot should use the freshest quote available.
    const { openPositions } = computeLedger(txns);
    const positions = openPositions.map((p) => ({
      region: p.region,
      ticker: p.ticker,
      qty: p.qty,
      avgCost: p.avgCost,
    }));
    if (positions.length === 0 && contributions.length === 0) return;

    // Live prices via the standard pipeline (withLivePrices handles the
    // fallback-to-cost-basis policy); fetch a current FX rate.
    const symbols = Array.from(
      new Map(positions.map((p) => [`${p.region}::${p.ticker}`, p])).values()
    );
    const historicalCloses: Record<string, HistoricalCloses> = {};
    await Promise.all(
      symbols.map(async (p) => {
        historicalCloses[`${p.region}::${p.ticker}`] = await fetchHistoricalCloses(
          toYahooSymbol(p.region, p.ticker),
          "5d"
        );
      })
    );
    const rates = await fetchFxRates();

    const cashByCurrency: Record<string, number> = {};
    for (const row of cashRows) cashByCurrency[row.currency] = row.balance;

    const value = dayValue({
      key,
      positions,
      historicalCloses,
      rates,
      cashByCurrency,
      costBasisSgd: outlayAsOf(contributions, key),
    });

    await prisma.dailySnapshot.upsert({
      where: { date: dayStart(key) },
      update: value,
      create: { date: dayStart(key), ...value },
    });
  } catch {
    // Never let snapshot recording break a page load.
  }
}

/** All snapshots oldest-first, shaped for the chart. */
export async function getSnapshots() {
  const rows = await prisma.dailySnapshot.findMany({ orderBy: { date: "asc" } });
  return rows.map((r) => ({
    date: dayKey(r.date),
    holdingsValueSgd: r.holdingsValueSgd,
    cashValueSgd: r.cashValueSgd,
    totalValueSgd: r.totalValueSgd,
    costBasisSgd: r.costBasisSgd,
  }));
}

/** Largest peak-to-trough decline as a negative fraction. Returns null with
 * fewer than 2 points, or when the portfolio never went below a high.
 *
 * Deliberately computed from drawdownSeries() rather than walking the series
 * again: the underwater chart plots that same series, and the headline number
 * on the home page must always equal the lowest point of the chart beneath it.
 */
export function maxDrawdown(points: PerfPoint[]): number | null {
  if (points.length < 2) return null;
  const series = drawdownSeries(points);
  if (series.length === 0) return null;
  const worst = Math.min(...series.map((s) => s.drawdown));
  return worst === 0 ? null : worst;
}
