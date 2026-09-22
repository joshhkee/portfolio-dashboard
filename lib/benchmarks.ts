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
import { portfolioDailyReturns, type PerfPoint } from "@/lib/performance";

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

/** Rescale so the first usable value is exactly 100. */
export function rebaseTo100(values: (number | null)[]): (number | null)[] {
  const base = values.find((v) => v !== null && v > 0);
  if (base === undefined || base === null) return values.map(() => null);
  return values.map((v) => (v === null ? null : (v / base) * 100));
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

export interface BenchmarkVerdict {
  /** Cumulative portfolio return over the window, contribution-neutral. */
  portfolioReturn: number;
  /** The index's return over the same dates. */
  benchmarkReturn: number;
  /** portfolio minus benchmark, in return points. Positive means it won. */
  difference: number;
  /** What the index's move alone would predict at the fitted beta. */
  expectedFromBeta: number;
  /** portfolio minus expectedFromBeta: the part beta does not explain. */
  alphaContribution: number;
  outperformedBenchmark: boolean;
  beatBetaExpectation: boolean;
}

/**
 * Turns the fitted statistics into the plain question they exist to answer:
 * did the portfolio beat the index, and did it beat what its own market
 * exposure would have delivered?
 *
 * Those are deliberately two different booleans. A low-beta portfolio can beat
 * its beta expectation while still trailing the index (it took less risk), and
 * a high-beta one can beat the index while trailing its beta expectation (it
 * took more risk than the gain justified). Collapsing them into one
 * "outperforming?" flag would hide exactly the cases worth knowing about.
 *
 * The alphaContribution split is an approximation, not the regression: beta is
 * fitted on DAILY returns and then applied to the window's cumulative return.
 * It is the right shape for an explanation, while the regression alpha above
 * remains the precise figure.
 *
 * Returns null rather than guessing when either series has fewer than two
 * usable points.
 */
export function benchmarkVerdict(
  portfolioIndex: number[],
  benchmarkIndex: (number | null)[],
  beta: number
): BenchmarkVerdict | null {
  if (portfolioIndex.length < 2) return null;
  const portfolioStart = portfolioIndex[0];
  const portfolioEnd = portfolioIndex[portfolioIndex.length - 1];
  if (!(portfolioStart > 0)) return null;

  const usable = benchmarkIndex.filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );
  if (usable.length < 2 || usable[0] <= 0) return null;

  const portfolioReturn = portfolioEnd / portfolioStart - 1;
  const benchmarkReturn = usable[usable.length - 1] / usable[0] - 1;
  const expectedFromBeta = beta * benchmarkReturn;
  const difference = portfolioReturn - benchmarkReturn;
  const alphaContribution = portfolioReturn - expectedFromBeta;

  return {
    portfolioReturn,
    benchmarkReturn,
    difference,
    expectedFromBeta,
    alphaContribution,
    outperformedBenchmark: difference > 0,
    beatBetaExpectation: alphaContribution > 0,
  };
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
