// Entry-timing signals for the watchlist: where a price sits in its year, how
// stretched it is, and which way its trend runs.
//
// The watchlist's 30-day sparkline cannot answer "is this a good entry" — it
// has no memory. Everything here needs a year of daily closes, which is the
// same `range=1y&interval=1d` fetch the benchmark and snapshot paths already
// make (`fetchHistoricalCloses`, cached an hour by Next because historical bars
// do not change), so this adds no new data source: it adds a batched, cached
// caller of the one that exists, exactly like lib/sparklines.ts.
//
// Two rules shape it:
//
//  1. **Nothing here is advice, and nothing is a score.** No composite "buy
//     rating" — a number with no units that nobody can check. The signals are
//     the four facts a person would otherwise look up somewhere else, each with
//     its own unit, so the owner can disagree with the read.
//  2. **Absent beats invented.** A ticker with 30 sessions has no 200-day
//     average; it reports null and the UI omits that fact rather than averaging
//     what it happens to have. Same for a price series with a single point.
//
// Pure math is exported separately from the fetch so it can be tested against
// hand-computed values with no network.

import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchHistoricalCloses, priceKey, toYahooSymbol } from "@/lib/prices";

/** A year of daily bars. ~250 sessions, which is enough for a 200-day average. */
export const SIGNAL_RANGE = "1y";

/** Bar count below which the longer averages and the range are not meaningful.
 *  Chosen as the shortest window any single signal needs, so one guard covers
 *  the whole set instead of each field answering for itself. */
export const MIN_SESSIONS = 200;

/** How long a set of computed signals is reused. Daily bars change once a day,
 *  and `fetchHistoricalCloses` already sits behind an hour of Next fetch cache,
 *  so this only saves the shaping and the upstream call. */
const TTL_MS = 60 * 60 * 1000;

const CONCURRENCY = 4;

/** Same bound as the sparklines endpoint: a malformed query cannot ask for
 *  thousands of tickers. */
export const MAX_SIGNAL_KEYS = 60;

const cache = new Map<string, { at: number; data: EntrySignals }>();

export interface EntrySignals {
  /** Daily closes the figures below were computed from. */
  sessions: number;
  /** Lowest and highest close over the window. */
  rangeLow: number | null;
  rangeHigh: number | null;
  /** Where the latest close sits in that range: 0 = at the low, 1 = at the
   *  high. Null when the range has no width (a flat series). */
  rangePosition: number | null;
  /** How far below the window high the latest close is, as a fraction. 0 means
   *  it IS the high. Negative values do not occur: the high is the maximum. */
  pctBelowHigh: number | null;
  rsi14: number | null;
  sma50: number | null;
  sma200: number | null;
  /** Latest close against each average, as a fraction. */
  vs50: number | null;
  vs200: number | null;
  /** Both averages present and agreeing:
   *  - `up`   price at or above the 50-day, which is at or above the 200-day
   *  - `down` price at or below the 50-day, which is at or below the 200-day
   *  - `mixed` anything else — which is most of the time, and is a real answer
   *    rather than a failure to decide. */
  trend: Trend | null;
}

export type Trend = "up" | "down" | "mixed";

const EMPTY: EntrySignals = {
  sessions: 0,
  rangeLow: null,
  rangeHigh: null,
  rangePosition: null,
  pctBelowHigh: null,
  rsi14: null,
  sma50: null,
  sma200: null,
  vs50: null,
  vs200: null,
  trend: null,
};

/** Simple moving average of the LAST `n` values, or null when there are fewer.
 *
 *  The last n, deliberately: a 200-day average answers "where has it traded
 *  lately", so including older bars to reach a round number of points would
 *  answer a different question. */
export function sma(values: number[], n: number): number | null {
  if (n <= 0 || values.length < n) return null;
  let sum = 0;
  for (let i = values.length - n; i < values.length; i++) sum += values[i];
  return sum / n;
}

/**
 * Wilder's RSI over `period` sessions (14 by default).
 *
 * Wilder's smoothing, not a plain average of gains and losses: the two agree on
 * a constant series and diverge sharply afterwards (see the test that pins
 * 44.44 where a simple mean gives 50), and every chart a person compares this
 * against uses Wilder's. The first average is seeded from the first `period`
 * changes, then each later change is smoothed `(prev * (period - 1) + new) /
 * period` — which also means the result depends on every bar, so it is computed
 * in one pass rather than only from the last 14.
 *
 * Returns 100 when there has been no down change at all and 0 when there has
 * been no up change, rather than dividing by zero.
 */
export function rsiWilder(closes: number[], period = 14): number | null {
  if (period <= 0 || closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  if (avgGain === 0) return 0;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export type RsiZone = "oversold" | "neutral" | "overbought";

/** The conventional 30 / 70 bands. Plain words, because "RSI 27" means nothing
 *  to anyone who has not memorised the scale.
 *
 *  Deliberately just the two bands: inventing a third ("strong", "extended")
 *  would be a judgement dressed as a measurement. */
export function rsiZone(rsi: number | null): RsiZone | null {
  if (rsi === null) return null;
  if (rsi <= 30) return "oversold";
  if (rsi >= 70) return "overbought";
  return "neutral";
}

/**
 * Every signal from one ascending series of daily closes (oldest first).
 *
 * Guards rather than guesses: fewer than `MIN_SESSIONS` bars reports the
 * session count and nulls everything else, so a newly listed ticker shows
 * "not enough history" instead of a 52-week range computed from nine days.
 */
export function entrySignals(closes: number[]): EntrySignals {
  const usable = closes.filter((c) => Number.isFinite(c));
  if (usable.length < MIN_SESSIONS) {
    return { ...EMPTY, sessions: usable.length };
  }

  const last = usable[usable.length - 1];
  let rangeLow = usable[0];
  let rangeHigh = usable[0];
  for (const value of usable) {
    if (value < rangeLow) rangeLow = value;
    if (value > rangeHigh) rangeHigh = value;
  }

  const span = rangeHigh - rangeLow;
  const sma50 = sma(usable, 50);
  const sma200 = sma(usable, 200);

  let trend: Trend | null = null;
  if (sma50 !== null && sma200 !== null) {
    if (last >= sma50 && sma50 >= sma200) trend = "up";
    else if (last <= sma50 && sma50 <= sma200) trend = "down";
    else trend = "mixed";
  }

  return {
    sessions: usable.length,
    rangeLow,
    rangeHigh,
    rangePosition: span > 0 ? (last - rangeLow) / span : null,
    pctBelowHigh: rangeHigh > 0 ? (rangeHigh - last) / rangeHigh : null,
    rsi14: rsiWilder(usable),
    sma50,
    sma200,
    vs50: sma50 && sma50 > 0 ? (last - sma50) / sma50 : null,
    vs200: sma200 && sma200 > 0 ? (last - sma200) / sma200 : null,
    trend,
  };
}

/**
 * Signals for a set of (region, ticker) pairs, keyed by `priceKey()`.
 *
 * Batched like the sparklines endpoint and for the same reason: a request per
 * row is a waterfall. Tickers whose history fetch fails, or that are too young
 * to have 200 sessions, come back with a zero-session shell — present, so the
 * UI can say "not enough history", rather than absent, which is
 * indistinguishable from still-loading.
 */
export async function getEntrySignals(
  keys: { region: string; ticker: string }[]
): Promise<Record<string, EntrySignals>> {
  const unique = new Map<string, { region: string; ticker: string }>();
  for (const k of keys) {
    if (!k.region || !k.ticker) continue;
    unique.set(priceKey(k.region, k.ticker), k);
  }

  const out: Record<string, EntrySignals> = {};
  const stale: { region: string; ticker: string }[] = [];
  for (const [key, k] of unique) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) out[key] = hit.data;
    else stale.push(k);
  }

  await mapWithConcurrency(stale, CONCURRENCY, async (k) => {
    const key = priceKey(k.region, k.ticker);
    const closes = await fetchHistoricalCloses(toYahooSymbol(k.region, k.ticker), SIGNAL_RANGE);
    // Keys are "YYYY-MM-DD", so a lexical sort is chronological. Ascending is
    // what every function above assumes (an SMA of the last n, an RSI that
    // walks forward), and a reversed series would produce a plausible-looking
    // wrong answer rather than an error.
    const series = Object.keys(closes)
      .sort()
      .map((day) => closes[day]);
    const data = entrySignals(series);
    cache.set(key, { at: Date.now(), data });
    out[key] = data;
  });

  return out;
}

/** Parse the `keys` query parameter. Accepts both separators for the same
 *  reason lib/sparklines.ts does: the response is keyed by `priceKey()`, so
 *  handing a key straight back is the obvious thing for a caller to do. */
export function parseSignalKeys(
  raw: string,
  limit: number = MAX_SIGNAL_KEYS
): { region: string; ticker: string }[] {
  const keys: { region: string; ticker: string }[] = [];
  for (const part of raw.split(",")) {
    const [region, ticker] = part.includes("::") ? part.split("::") : part.split(":");
    if (region?.trim() && ticker?.trim()) keys.push({ region: region.trim(), ticker: ticker.trim() });
    if (keys.length >= limit) break;
  }
  return keys;
}
