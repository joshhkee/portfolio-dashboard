// Historical SGD exchange rates.
//
// Attribution has to price each trade at the SGD rate OF ITS OWN DAY rather
// than today's, or every historical figure gets restated whenever the dollar
// moves. Yahoo publishes USD/SGD and USD/HKD as ordinary daily series, so the
// historical rates come from the same endpoint the rest of the app already
// uses, and the cross rate (SGD per HKD) is derived rather than fetched.
//
// Scope note: this answers "what did the currency do on a date", which is
// distinct from the FX a conversion actually realised. The deposit ledger
// records the real conversions, and lib/fx.ts quotes today's rates; this file
// exists only so a dated historical figure can be recomputed consistently.
//
// Everything is shaped ONCE into "SGD per one unit of the currency", because
// Yahoo's quoting direction (units of foreign currency per 1 USD) is the
// opposite of what every caller here wants. Callers that got that backwards
// would be off by factors of 1.3-7.8 while still looking plausible.
//
// Network cost is bounded: two symbols, a 15-minute in-process cache plus
// single-flight on top of Next's own 1-hour fetch cache — so this is a couple
// of upstream requests an hour no matter how often the page renders.

import { alignCloses, fetchHistoricalCloses, type HistoricalCloses } from "@/lib/prices";
import type { Currency } from "@/lib/fx";

/** "YYYY-MM-DD" -> SGD per one unit of that currency. */
export interface SgdRateSeries {
  SGD: HistoricalCloses;
  USD: HistoricalCloses;
  HKD: HistoricalCloses;
}

const TTL_MS = 15 * 60 * 1000;

/**
 * Five years of daily bars. The ledger only spans back to 2025, but sizing the
 * window generously means a position bought years ago still resolves to its
 * own purchase-date rate instead of silently falling back to today's.
 */
const RANGE = "5y";

let cache: { at: number; series: SgdRateSeries } | null = null;
let inflight: Promise<SgdRateSeries> | null = null;

/** Pure: derive SGD-per-unit series from the two USD-quoted ones. */
export function buildSgdRateSeries(
  sgdPerUsd: HistoricalCloses,
  hkdPerUsd: HistoricalCloses
): SgdRateSeries {
  const days = Array.from(
    new Set([...Object.keys(sgdPerUsd), ...Object.keys(hkdPerUsd)])
  ).sort();

  // Carry each series' last close across the union of days, so a date present
  // in one series and missing from the other still gets a rate (markets close
  // on different days) instead of a hole.
  const alignedSgd = alignCloses(days, sgdPerUsd);
  const alignedHkd = alignCloses(days, hkdPerUsd);

  const series: SgdRateSeries = { SGD: {}, USD: {}, HKD: {} };
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    series.SGD[day] = 1; // SGD per SGD
    const usd = alignedSgd[i];
    if (usd === null) continue;
    series.USD[day] = usd;
    const hkd = alignedHkd[i];
    // SGD per HKD = (SGD per USD) / (HKD per USD) — the cross rate.
    if (hkd !== null && hkd > 0) series.HKD[day] = usd / hkd;
  }
  return series;
}

/** Daily SGD-per-unit closes for the three currencies the ledger uses. */
export async function getSgdRateSeries(): Promise<SgdRateSeries> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.series;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const [sgdPerUsd, hkdPerUsd] = await Promise.all([
        fetchHistoricalCloses("SGD=X", RANGE),
        fetchHistoricalCloses("HKD=X", RANGE),
      ]);
      const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);
      // An empty result is NOT cached: one transient Yahoo failure must not
      // pin every position to today's rate for the next 15 minutes.
      if (Object.keys(series.USD).length > 0) cache = { at: Date.now(), series };
      return series;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * SGD per one unit of `currency` on a calendar day, carrying the last known
 * close forward from the most recent trading day.
 *
 * Returns null when the day predates the series — the caller decides what to
 * fall back to and, importantly, can COUNT those cases and say so, rather than
 * quietly attributing a purchase to today's rate as if it were measured.
 */
export function sgdRateOn(
  series: SgdRateSeries,
  currency: Currency,
  dateKey: string
): number | null {
  const closes = series[currency];
  if (!closes || Object.keys(closes).length === 0) return null;
  const [rate] = alignCloses([dateKey], closes);
  return rate ?? null;
}
