// Portfolio performance math.
//
// Everything here is PURE and operates on the DailySnapshot series (see
// lib/snapshots.ts), which stores, per UTC day, the portfolio's total value and
// the cumulative outlay (cost basis) recorded as of that day.
//
// Two different questions, two different answers:
//
//   XIRR (lib/xirr.ts)  — money-weighted. Matches what the owner actually
//                         earned, and is inflated/deflated by WHEN money was
//                         added. Contributes monthly, so this is a real effect.
//   TWR (here)          — time-weighted. Neutralizes contribution timing by
//                         measuring the growth of each dollar already invested,
//                         so it describes the strategy rather than the schedule.
//
// They should agree for a single lump sum and diverge when contributions are
// uneven — pinned by tests.

export interface PerfPoint {
  date: string; // "YYYY-MM-DD" (UTC)
  totalValueSgd: number;
  costBasisSgd: number; // cumulative outlay as of that day
}

export type RangeKey = "1M" | "3M" | "YTD" | "1Y" | "3Y" | "ALL";

export const RANGE_KEYS: RangeKey[] = ["1M", "3M", "YTD", "1Y", "3Y", "ALL"];

const DAY_MS = 86400000;
const RANGE_DAYS: Partial<Record<RangeKey, number>> = {
  "1M": 30,
  "3M": 91,
  "1Y": 365,
  "3Y": 1096,
};

function toMs(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

/**
 * Slice the series to a window ending today. Includes ONE point before the
 * window start where possible, so the first segment of the chart has a prior
 * value to grow from instead of starting mid-air.
 *
 * Note this is a *display* filter only — the performance figures that matter
 * (TWR, XIRR, max drawdown) are computed from the full series unless a caller
 * deliberately passes a slice.
 */
export function filterByRange(
  points: PerfPoint[],
  range: RangeKey,
  now: Date = new Date()
): PerfPoint[] {
  if (range === "ALL" || points.length === 0) return points;

  let startMs: number;
  if (range === "YTD") {
    startMs = Date.UTC(now.getUTCFullYear(), 0, 1);
  } else {
    const days = RANGE_DAYS[range];
    if (days === undefined) return points;
    startMs = now.getTime() - days * DAY_MS;
  }

  const firstInside = points.findIndex((p) => toMs(p.date) >= startMs);
  if (firstInside <= 0) return points; // window covers everything we have
  return points.slice(firstInside - 1);
}

/**
 * Cumulative time-weighted return over the series — a chain of daily returns
 * with each day's new contributions removed, so adding money doesn't register
 * as growth.
 *
 * Per day: r = (V_t − V_{t−1} − newMoney_t) / V_{t−1}
 * where newMoney is the day-over-day increase in cumulative outlay. That
 * difference is exactly why DailySnapshot stores costBasisSgd alongside the
 * value: it makes the cashflow reconstruction free, with no extra query.
 *
 * Returns null when there aren't two usable points (nothing to chain).
 */
export function timeWeightedReturn(points: PerfPoint[]): number | null {
  if (points.length < 2) return null;

  let factor = 1;
  let chained = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];

    // A zero/negative base can't produce a meaningful ratio.
    if (prev.totalValueSgd <= 0) continue;

    const newMoney = cur.costBasisSgd - prev.costBasisSgd;
    let daily = (cur.totalValueSgd - prev.totalValueSgd - newMoney) / prev.totalValueSgd;
    if (!Number.isFinite(daily)) continue;

    // Losing more than the entire portfolio in one day is a data artefact
    // (bad snapshot), not a return; clamp so it can't flip the sign of the
    // compounded result.
    if (daily < -1) daily = -1;

    factor *= 1 + daily;
    chained++;
  }

  if (chained === 0) return null;
  return factor - 1;
}

/**
 * Annualize a cumulative return over an elapsed span. Returns null for spans
 * shorter than a month — annualizing a few weeks of data produces absurd
 * numbers that are worse than showing nothing.
 */
export function annualizeReturn(
  totalReturn: number,
  fromDate: string,
  toDate: string
): number | null {
  const days = (toMs(toDate) - toMs(fromDate)) / DAY_MS;
  if (!Number.isFinite(days) || days < 30) return null;

  const base = 1 + totalReturn;
  if (base <= 0) return null; // total wipeout: no real rate exists

  return Math.pow(base, 365.25 / days) - 1;
}

export interface DrawdownPoint {
  date: string;
  /** Fraction below the running peak, e.g. -0.138 for −13.8%. Zero at a new high. */
  drawdown: number;
}

/**
 * Drawdown from the running peak, per day — the "underwater" curve. The
 * minimum of this series is by definition the max drawdown, which is why
 * maxDrawdown() in lib/snapshots.ts is implemented in terms of it rather than
 * walking the series a second time.
 */
export function drawdownSeries(points: PerfPoint[]): DrawdownPoint[] {
  if (points.length === 0) return [];

  let peak = points[0].totalValueSgd;
  return points.map((p) => {
    if (p.totalValueSgd > peak) peak = p.totalValueSgd;
    const drawdown = peak > 0 ? (p.totalValueSgd - peak) / peak : 0;
    return { date: p.date, drawdown };
  });
}

export interface YearReturn {
  year: number;
  startValue: number;
  endValue: number;
  /** Net new money added during the year. */
  contributions: number;
  /** Time-weighted return for the year, or null if uncomputable. */
  returnPct: number | null;
}

/**
 * Per-calendar-year figures, oldest first — the factsheet-style table. Each
 * year's return is TWR over that year's slice, so a year is comparable to a
 * benchmark's year even though the owner kept adding money throughout.
 */
export function yearlyReturns(points: PerfPoint[]): YearReturn[] {
  const byYear = new Map<number, PerfPoint[]>();
  for (const p of points) {
    const year = Number(p.date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const rows = byYear.get(year);
    if (rows) rows.push(p);
    else byYear.set(year, [p]);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, rows]) => {
      const first = rows[0];
      const last = rows[rows.length - 1];
      return {
        year,
        startValue: first.totalValueSgd,
        endValue: last.totalValueSgd,
        contributions: last.costBasisSgd - first.costBasisSgd,
        returnPct: timeWeightedReturn(rows),
      };
    });
}
