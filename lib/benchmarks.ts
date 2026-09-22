// Benchmark indices, and the math that turns "did this beat the index?"
// into a number.
//
// XIRR/TWR on their own can't answer that — +17% is a good year for a
// portfolio and a bad one for an index, and the only way to tell the two
// apart is to plot both against the same starting line. Indices come from
// the same Yahoo chart endpoint the app already prices with
// (lib/prices.ts), so there is no second provider to keep working.
//
// Everything downstream of the fetch is PURE and lives here rather than in
// the components, so the regression can be tested against known arithmetic
// instead of against pixels.

import { fetchHistoricalCloses, type HistoricalCloses } from "@/lib/prices";
import type { PerfPoint } from "@/lib/performance";

export interface BenchmarkDef {
  key: string;
  label: string;
  symbol: string;
}

/**
 * Chosen so the three markets this portfolio actually holds are covered:
 * US large cap (^GSPC), global developed equity (URTH tracks MSCI World),
 * and Singapore (^STI). They are price indices in their own currencies —
 * that is the honest comparison for a *market* benchmark, and because the
 * chart below rebases everything to a growth index rather than comparing
 * absolute money, no currency conversion is needed to make them comparable.
 */
export const BENCHMARKS: BenchmarkDef[] = [
  { key: "SPX", label: "S&P 500", symbol: "^GSPC" },
  { key: "WORLD", label: "MSCI World", symbol: "URTH" },
  { key: "STI", label: "Straits Times", symbol: "^STI" },
];

/** How long a fetched benchmark series is reused before going back to Yahoo. */
const TTL_MS = 15 * 60 * 1000;
const DEFAULT_RANGE = "5y";

const cache = new Map<string, { at: number; data: HistoricalCloses }>();
const inFlight = new Map<string, Promise<HistoricalCloses>>();

/**
 * Historical closes for one benchmark symbol, memoized per (symbol, range).
 *
 * Two things matter here. First, an in-process TTL cache, so repeated page
 * loads don't re-fetch history that changes at most once a day. Second,
 * single-flight: concurrent renders (the home page fetches all three
 * benchmarks at once, and Next may render more than one request in
 * parallel) share one request per symbol instead of each starting its own.
 *
 * A failed fetch is deliberately NOT cached — an empty map is the "I don't
 * know" value, and memoizing it would blank the benchmark chart for the
 * whole TTL after one transient Yahoo hiccup.
 */
export async function getBenchmarkCloses(
  symbol: string,
  range: string = DEFAULT_RANGE
): Promise<HistoricalCloses> {
  const key = `${symbol}:${range}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchHistoricalCloses(symbol, range)
    .then((data) => {
      if (Object.keys(data).length > 0) cache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * One close per requested date, carrying the previous close forward.
 *
 * Benchmark series are trading-day only while DailySnapshot rows are
 * calendar-daily, so an exact-date lookup would leave every weekend and
 * holiday as a hole. Carrying the last close forward keeps the two series
 * the same length and index-aligned — which matters because the regression
 * below pairs them positionally.
 *
 * Dates before the benchmark has any data yield null rather than the first
 * later close, so a window that starts earlier than the index (or a symbol
 * Yahoo returns nothing for) shows as a gap instead of a fabricated flat line.
 */
export function alignCloses(dates: string[], closes: HistoricalCloses): (number | null)[] {
  const keys = Object.keys(closes).sort();
  if (keys.length === 0) return dates.map(() => null);

  const out: (number | null)[] = [];
  let cursor = -1; // index into keys of the newest close <= the current date
  for (const date of dates) {
    while (cursor + 1 < keys.length && keys[cursor + 1] <= date) cursor++;
    out.push(cursor >= 0 ? closes[keys[cursor]] : null);
  }
  return out;
}

/** Rescale so the first usable value is exactly 100. */
export function rebaseTo100(values: (number | null)[]): (number | null)[] {
  const base = values.find((v) => v !== null && v > 0);
  if (base === undefined || base === null) return values.map(() => null);
  return values.map((v) => (v === null ? null : (v / base) * 100));
}

/** Fractional change between consecutive values; NaN where a pair is unusable. */
export function benchmarkDailyReturns(values: (number | null)[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev === null || cur === null || prev <= 0) {
      out.push(NaN);
      continue;
    }
    out.push(cur / prev - 1);
  }
  return out;
}

/**
 * Daily portfolio returns with contributions removed — the same formula
 * timeWeightedReturn() chains, exposed per-day so it can be regressed against
 * a benchmark. Losing more than the whole portfolio in one day is a bad
 * snapshot rather than a return, so it's clamped; a zero/negative base yields
 * NaN, which the regression drops instead of letting it poison the fit.
 */
export function portfolioDailyReturns(points: PerfPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev.totalValueSgd <= 0) {
      out.push(NaN);
      continue;
    }
    const newMoney = cur.costBasisSgd - prev.costBasisSgd;
    let daily = (cur.totalValueSgd - prev.totalValueSgd - newMoney) / prev.totalValueSgd;
    if (!Number.isFinite(daily)) daily = NaN;
    else if (daily < -1) daily = -1;
    out.push(daily);
  }
  return out;
}

/**
 * A contribution-neutral growth index starting at 100.
 *
 * This is what makes a portfolio line comparable to a price index. Plotting
 * raw portfolio *value* against an index would show a big step up every time
 * money was deposited, and the owner deposits monthly — so the line would
 * mostly measure deposits. Chaining the contribution-stripped daily returns
 * instead gives the growth of the money already invested, which is the same
 * quantity an index measures.
 */
export function growthIndex(points: PerfPoint[]): number[] {
  const returns = portfolioDailyReturns(points);
  const index = [100];
  for (const r of returns) {
    const last = index[index.length - 1];
    index.push(Number.isFinite(r) ? last * (1 + r) : last);
  }
  return index;
}

export interface AlphaBetaResult {
  /** Annualized excess return over the benchmark, arithmetic (daily × 252). */
  alphaAnnual: number;
  /** Sensitivity to the benchmark: 1.0 tracks it, >1 amplifies it. */
  beta: number;
  /** Share of the portfolio's variance explained by the benchmark. */
  r2: number;
  correlation: number;
  /** Overlapping daily observations actually used in the fit. */
  n: number;
}

const MIN_OBSERVATIONS = 5;

/**
 * Ordinary least squares of portfolio daily returns on benchmark daily
 * returns: `r_p = alpha + beta · r_b + e`.
 *
 * The two inputs are paired BY INDEX, so callers must slice both from the
 * same window (see BenchmarkComparison) — pairing returns from different
 * date ranges would silently produce a meaningless beta.
 *
 * NaN entries (missing benchmark day, unusable portfolio day) are dropped
 * pairwise rather than truncated, so a single Yahoo gap doesn't discard the
 * whole window. Returns null when there aren't enough usable pairs, or when
 * the benchmark has no variance at all (a flat line can't explain anything).
 */
export function alphaBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): AlphaBetaResult | null {
  const pairs: { p: number; b: number }[] = [];
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  for (let i = 0; i < n; i++) {
    const p = portfolioReturns[i];
    const b = benchmarkReturns[i];
    if (Number.isFinite(p) && Number.isFinite(b)) pairs.push({ p, b });
  }
  if (pairs.length < MIN_OBSERVATIONS) return null;

  const count = pairs.length;
  let meanP = 0;
  let meanB = 0;
  for (const { p, b } of pairs) {
    meanP += p;
    meanB += b;
  }
  meanP /= count;
  meanB /= count;

  let cov = 0;
  let varP = 0;
  let varB = 0;
  for (const { p, b } of pairs) {
    const dp = p - meanP;
    const db = b - meanB;
    cov += dp * db;
    varP += dp * dp;
    varB += db * db;
  }
  cov /= count;
  varP /= count;
  varB /= count;

  if (varB <= 1e-12) return null;

  const beta = cov / varB;
  const alphaDaily = meanP - beta * meanB;
  const denom = Math.sqrt(varP * varB);
  const correlation = denom === 0 ? 0 : cov / denom;

  return {
    // Arithmetic annualization: alpha here is a regression intercept on daily
    // returns, so compounding it would imply a reinvestment assumption the
    // regression never made. Labelled with its window in the UI for the same
    // reason — an annualized alpha from a 3-month window is a rough guide.
    alphaAnnual: alphaDaily * 252,
    beta,
    r2: correlation * correlation,
    correlation,
    n: count,
  };
}
