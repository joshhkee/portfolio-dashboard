// Backfills DailySnapshot rows for days before the app started recording
// them. Replays the ledger as-of each day and prices holdings at that
// day's Yahoo historical close. Usage:
//
//   npm run backfill
//
// Idempotent: existing snapshot rows are overwritten with recomputed
// values, so it's safe to run repeatedly (e.g. after correcting the
// ledger). Today's row is left alone — the live page-load writer owns it.

import { PrismaClient } from "@prisma/client";
import { computeLedger, fromDbRows } from "../lib/portfolio-engine";
import { fetchHistoricalCloses, toYahooSymbol, type HistoricalCloses } from "../lib/prices";
import { convertCurrency, fetchFxRates } from "../lib/fx";
import { positionsAsOf, outlayAsOf, dayValue, dayKey } from "../lib/snapshots";

const prisma = new PrismaClient();

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [rawTxns, contributions, cashRows] = await Promise.all([
    prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
    prisma.contribution.findMany({ select: { date: true, amount: true } }),
    prisma.cashBalance.findMany(),
  ]);
  const txns = fromDbRows(rawTxns);
  if (txns.length === 0) {
    console.log("No transactions — nothing to backfill.");
    return;
  }

  // Today's snapshot is owned by the live page-load writer; backfill
  // everything up to yesterday.
  const todayKey = utcDayKey(new Date());
  const firstDay = txns.reduce(
    (min, t) => (t.date.getTime() < min ? t.date.getTime() : min),
    Date.now()
  );
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() - 1); // start a day early so the first trade day has a prior close

  console.log(`Backfilling snapshots from ${utcDayKey(start)} to yesterday...`);

  // Historical closes for every ticker ever held, fetched once.
  const tickerKeys = Array.from(new Set(txns.map((t) => `${t.region}::${t.ticker}`)));
  const historicalCloses: Record<string, HistoricalCloses> = {};
  for (const key of tickerKeys) {
    const [region, ticker] = key.split("::");
    const symbol = toYahooSymbol(region, ticker);
    // Range: from a bit before inception to today, capped at Yahoo's max.
    const years = Math.ceil((Date.now() - firstDay) / (365.25 * 86400000)) + 1;
    const range = years <= 1 ? "1y" : years <= 2 ? "2y" : years <= 5 ? "5y" : "10y";
    process.stdout.write(`  fetching ${symbol} (${range})... `);
    historicalCloses[key] = await fetchHistoricalCloses(symbol, range);
    console.log(`${Object.keys(historicalCloses[key]).length} days`);
    // Yahoo rate-limits aggressively; be a polite client.
    await new Promise((r) => setTimeout(r, 500));
  }

  const rates = await fetchFxRates();
  const cashByCurrency: Record<string, number> = {};
  for (const row of cashRows) cashByCurrency[row.currency] = row.balance;

  // Cash history: cash balances auto-adjust from the ledger, so replay
  // the same rule the app applies on writes:
  //   contribution -> +amount SGD-equivalent (recorded in SGD)
  //   buy -> -qty*price in region currency, sell -> +
  // This mirrors lib/cash.ts usage in the API routes. It's an
  // approximation for days before the app tracked cash, but better than
  // a flat zero or today's balance held constant backwards.
  let cash = { SGD: 0, USD: 0, HKD: 0 };
  const regionCurrency: Record<string, "SGD" | "USD" | "HKD"> = { SG: "SGD", US: "USD", HK: "HKD" };

  let written = 0;
  const cursor = new Date(start);
  while (utcDayKey(cursor) < todayKey) {
    const key = utcDayKey(cursor);
    const cutoff = new Date(`${key}T23:59:59.999Z`).getTime();

    // --- cash as-of this day ---
    cash = { SGD: 0, USD: 0, HKD: 0 };
    for (const c of contributions) {
      if (c.date.getTime() <= cutoff) cash.SGD += c.amount;
    }
    for (const t of txns) {
      if (t.date.getTime() > cutoff) continue;
      const currency = regionCurrency[t.region];
      if (currency) cash[currency] += (t.action === "Buy" ? -1 : 1) * t.qty * t.price;
    }

    const positions = positionsAsOf(txns, key).map((p) => ({
      region: p.region,
      ticker: p.ticker,
      qty: p.qty,
      avgCost: p.avgCost,
    }));

    const value = dayValue({
      key,
      positions,
      historicalCloses,
      rates,
      cashByCurrency: cash,
      costBasisSgd: outlayAsOf(contributions, key),
    });

    await prisma.dailySnapshot.upsert({
      where: { date: new Date(`${key}T00:00:00.000Z`) },
      update: value,
      create: { date: new Date(`${key}T00:00:00.000Z`), ...value },
    });
    written++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  console.log(`Done — wrote ${written} snapshot rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
