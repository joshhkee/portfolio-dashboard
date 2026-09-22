// Concentration and risk statistics — the "am I taking a risk I didn't mean
// to take?" lens.
//
// Everything here is PURE and takes plain numbers, for the same reason the
// performance and benchmark math does: these numbers get read as advice, so
// they have to be testable against known arithmetic rather than eyeballed in
// a chart. Fetching lives in the API route; this module never touches I/O.

import { alignCloses, type HistoricalCloses } from "@/lib/prices";
import {
  annualizeReturn,
  priceReturns,
  timeWeightedReturn,
  type PerfPoint,
} from "@/lib/performance";

/**
 * Annualization basis for a CALENDAR-daily series.
 *
 * DailySnapshot rows exist for every calendar day while markets trade ~252
 * days a year, so weekend/payday observations are genuine zeros in the
 * series. Scaling the standard deviation by sqrt(365) rather than sqrt(252)
 * is what makes that consistent: the zeros dilute the variance by
 * 252/365, and multiplying by sqrt(365) undoes exactly that dilution,
 * recovering the same figure a trading-day series would produce.
 */
const CALENDAR_DAYS_PER_YEAR = 365;

/**
 * The rate a risk-free alternative would pay, used only by the Sharpe ratio.
 *
 * A stated assumption rather than a fetched number: it is displayed next to
 * the ratio in the UI so the reader can judge it, and it is deliberately
 * conservative (roughly what SGD government bills have paid) because the
 * portfolio is SGD-denominated and could have held bills instead.
 */
export const RISK_FREE_RATE = 0.035;

/** Below this annualized volatility a Sharpe ratio is arithmetic noise. */
const MIN_VOLATILITY = 0.001;

/** Fewer overlapping days than this and a correlation is not worth printing. */
const MIN_CORRELATION_PAIRS = 20;

export interface ConcentrationResult {
  /** Positions with a positive value. Zero-value rows are not "holdings". */
  count: number;
  /** Biggest single position as a fraction of the total, e.g. 0.31. */
  largestWeight: number;
  /** Combined weight of the five largest positions. */
  top5Weight: number;
  /** Herfindahl-Hirschman index: sum of squared weights, 1/count .. 1. */
  hhi: number;
  /** 1/HHI — "this portfolio behaves like N equally sized positions". */
  effectiveN: number;
  band: ConcentrationBand;
}

export type ConcentrationBand = "low" | "moderate" | "high";

/**
 * The conventional HHI reading, borrowed from competition policy and widely
 * reused for portfolios: under 0.15 is diversified, 0.15-0.25 is moderately
 * concentrated, above 0.25 is concentrated.
 *
 * It is a rule of thumb, not a verdict — a deliberate single-stock bet is not
 * a mistake — which is why the UI shows the number and the band rather than a
 * warning.
 */
export function concentrationBand(hhi: number): ConcentrationBand {
  if (hhi >= 0.25) return "high";
  if (hhi >= 0.15) return "moderate";
  return "low";
}

/**
 * Herfindahl-Hirschman concentration over position values.
 *
 * HHI is preferred to "largest position" alone because it is sensitive to the
 * whole shape: ten equal holdings and one 90% holding can share a single
 * largest-weight number only in the trivial sense, but their HHI (0.10 vs
 * 0.81) is unmistakably different. Returns null when there is nothing to
 * measure (no positive values), rather than reporting 0% concentration.
 */
export function concentration(values: number[]): ConcentrationResult | null {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  const total = positive.reduce((sum, v) => sum + v, 0);
  if (positive.length === 0 || total <= 0) return null;

  const weights = positive.map((v) => v / total).sort((a, b) => b - a);
  const hhi = weights.reduce((sum, w) => sum + w * w, 0);
  const topFive = weights.slice(0, 5).reduce((sum, w) => sum + w, 0);

  return {
    count: positive.length,
    largestWeight: weights[0],
    top5Weight: topFive,
    hhi,
    effectiveN: hhi > 0 ? 1 / hhi : 0,
    band: concentrationBand(hhi),
  };
}

/**
 * Annualized standard deviation of the given daily returns.
 *
 * Uses the sample (n−1) estimator, filters NaN rather than propagating it
 * (a missing day must not wipe out the statistic), and annualizes with the
 * calendar-day basis documented above. A perfectly flat series is a real
 * answer — zero volatility — not an error.
 */
export function annualizedVolatility(
  dailyReturns: number[],
  periodsPerYear: number = CALENDAR_DAYS_PER_YEAR
): number | null {
  const usable = dailyReturns.filter((r) => Number.isFinite(r));
  if (usable.length < 2) return null;

  const mean = usable.reduce((sum, r) => sum + r, 0) / usable.length;
  const variance =
    usable.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (usable.length - 1);
  if (!Number.isFinite(variance)) return null;

  return Math.sqrt(variance * periodsPerYear);
}

/**
 * (annualized return − risk-free rate) / annualized volatility.
 *
 * Returns null instead of infinity when volatility is ~zero: a risk-free
 * return divided by no risk is not a great Sharpe ratio, it is an undefined
 * one, and printing a huge number there would be actively misleading.
 */
export function sharpeRatio(
  annualReturn: number | null,
  volatility: number | null,
  riskFreeRate: number = RISK_FREE_RATE
): number | null {
  if (annualReturn === null || volatility === null) return null;
  if (!Number.isFinite(annualReturn) || !Number.isFinite(volatility)) return null;
  if (volatility <= MIN_VOLATILITY) return null;
  return (annualReturn - riskFreeRate) / volatility;
}

export interface LargestMove {
  date: string;
  /** Signed return on that day, e.g. -0.0999. */
  value: number;
  /**
   * Share of the sample's total variance this ONE day accounts for, 0..1.
   *
   * This is the number that makes a bad observation obvious: a single day that
   * carries a third of the variance will dominate every risk statistic built
   * on the series, however good the other 500 days are.
   */
  varianceShare: number;
}

/**
 * The largest single-day move and how much of the variance it carries.
 *
 * Exists because a portfolio's volatility is dominated by its worst days, so
 * one implausible observation — a snapshot taken mid-edit, a bad FX print —
 * can be most of the risk number. Deliberately reported rather than filtered:
 * dropping outliers automatically would make volatility inconsistent with the
 * TWR computed from the same series (which still counts that day), and would
 * hide a data error instead of showing it.
 *
 * `dates` must align 1:1 with `dailyReturns` (both start at the second
 * snapshot), so the reported date matches the move.
 */
export function largestMove(dailyReturns: number[], dates: string[]): LargestMove | null {
  const usable = dailyReturns.filter((r) => Number.isFinite(r));
  if (usable.length === 0 || dates.length < dailyReturns.length) return null;

  const mean = usable.reduce((sum, r) => sum + r, 0) / usable.length;
  const total = usable.reduce((sum, r) => sum + (r - mean) ** 2, 0);

  let index = -1;
  let magnitude = -1;
  for (let i = 0; i < dailyReturns.length; i++) {
    const r = dailyReturns[i];
    if (!Number.isFinite(r)) continue;
    if (Math.abs(r) > magnitude) {
      magnitude = Math.abs(r);
      index = i;
    }
  }
  if (index < 0) return null;

  const deviation = (dailyReturns[index] - mean) ** 2;
  return {
    date: dates[index],
    value: dailyReturns[index],
    varianceShare: total > 0 ? deviation / total : 0,
  };
}

export interface CorrelationMatrix {
  /** Compound "REGION::TICKER" keys, sorted; rows and columns share this order. */
  keys: string[];
  /** matrix[i][j] is the Pearson correlation of daily returns, or null. */
  matrix: (number | null)[][];
  /** Trading days spanned by the union of the series, before pairing. */
  observations: number;
}

/**
 * Pairwise Pearson correlation of daily returns between instruments.
 *
 * Two decisions worth stating. Series are aligned on the union of their
 * dates and each close is carried forward (alignCloses), because US, SG and
 * HK markets keep different holidays — comparing "day 40" of two series
 * without aligning dates would silently correlate different days. And each
 * PAIR uses only its own overlapping usable days (pairwise-complete) rather
 * than dropping every date where any instrument is missing, which on a
 * cross-market portfolio would throw away most of the sample.
 *
 * The diagonal is defined as 1 for readability; the lower and upper halves
 * are computed independently, which is cheap and makes an asymmetric bug
 * visible in a test rather than hidden by mirroring.
 */
export function correlationMatrix(closes: Record<string, HistoricalCloses>): CorrelationMatrix {
  const keys = Object.keys(closes)
    .filter((k) => Object.keys(closes[k] ?? {}).length >= 2)
    .sort();

  if (keys.length === 0) return { keys: [], matrix: [], observations: 0 };

  const dates = Array.from(new Set(keys.flatMap((k) => Object.keys(closes[k])))).sort();
  const series = keys.map((k) => priceReturns(alignCloses(dates, closes[k])));

  const matrix = keys.map((_, i) =>
    keys.map((__, j) => (i === j ? 1 : pearson(series[i], series[j])))
  );

  return { keys, matrix, observations: dates.length };
}

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      xs.push(a[i]);
      ys.push(b[i]);
    }
  }
  if (xs.length < MIN_CORRELATION_PAIRS) return null;

  const meanX = xs.reduce((sum, v) => sum + v, 0) / xs.length;
  const meanY = ys.reduce((sum, v) => sum + v, 0) / ys.length;

  let covariance = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  // A flat series has no variance, so its correlation is undefined — not 0,
  // which would read as "uncorrelated" and be a different claim.
  if (varX <= 0 || varY <= 0) return null;
  return covariance / Math.sqrt(varX * varY);
}

const DAY_MS = 86_400_000;

function dayMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

/**
 * Trailing-window annualized return, one value per input point (null where
 * the window isn't yet full).
 *
 * This is the honest way to show "how has the last year gone, over time":
 * a single cumulative number hides that a 12% year was −8% then +21%. The
 * window is measured in calendar days and the return inside it is the same
 * contribution-stripped chaining TWR uses, then annualized, so a point on
 * this line means the same thing as the headline TWR does.
 *
 * Points are emitted only once the window actually spans `windowDays`, so a
 * short history yields a shorter line rather than a plausible-looking
 * extrapolation from two months of data.
 */
export function rollingAnnualizedReturn(
  points: PerfPoint[],
  windowDays = 365
): (number | null)[] {
  const times = points.map((p) => dayMs(p.date));
  const out: (number | null)[] = [];
  let start = 0;

  for (let i = 0; i < points.length; i++) {
    while (times[i] - times[start] > windowDays * DAY_MS) start++;

    const spanDays = (times[i] - times[start]) / DAY_MS;
    if (spanDays < windowDays || i - start < 2) {
      out.push(null);
      continue;
    }

    const window = points.slice(start, i + 1);
    const total = timeWeightedReturn(window);
    out.push(
      total === null ? null : annualizeReturn(total, window[0].date, window[window.length - 1].date)
    );
  }

  return out;
}
