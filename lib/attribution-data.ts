// Historical closes for contribution attribution.
//
// Attribution needs a price for EVERY instrument at EVERY month end, so unlike
// the sparkline fetcher (30 days, one series per visible row) this asks for
// years of daily bars for every ticker the ledger has ever traded — ~26 symbols
// here. Two things keep that affordable:
//
//  - a process-level TTL cache, so a page re-render doesn't re-request series
//    that are months long and change once a day, and
//  - bounded concurrency, so a cold cache doesn't open 26 sockets to Yahoo in
//    the same tick.
//
// fetchHistoricalCloses already sits behind Next's 1-hour fetch cache, so a
// repeat inside the hour is served from the data cache anyway; the cache here
// also covers the fact that this is the largest fan-out in the app.

import { mapWithConcurrency } from "@/lib/concurrency";
import {
  fetchHistoricalCloses,
  priceKey,
  toYahooSymbol,
  type HistoricalCloses,
} from "@/lib/prices";

/** How long a fetched series is reused before asking again. */
const TTL_MS = 15 * 60 * 1000;

/** Yahoo requests in flight at once. */
const CONCURRENCY = 4;

/**
 * Five years. The ledger starts in 2025, but sizing the window generously means
 * an older position's month-end values are measured rather than approximated,
 * and it matches the window the FX history uses.
 */
const RANGE = "5y";

const cache = new Map<string, { at: number; closes: HistoricalCloses }>();

export interface CloseKey {
  region: string;
  ticker: string;
}

/**
 * Closes per compound "REGION::TICKER" key, oldest data included.
 *
 * Symbols Yahoo returns nothing for are simply absent — the attribution treats
 * a missing series as "value this position at cost", which makes its
 * contribution exactly its cash flow rather than a fabricated one.
 */
export async function getAttributionCloses(
  keys: CloseKey[]
): Promise<Record<string, HistoricalCloses>> {
  const unique = new Map<string, CloseKey>();
  for (const k of keys) {
    if (k.region && k.ticker) unique.set(priceKey(k.region, k.ticker), k);
  }

  const out: Record<string, HistoricalCloses> = {};
  const stale: CloseKey[] = [];
  for (const [key, k] of unique) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) out[key] = hit.closes;
    else stale.push(k);
  }

  await mapWithConcurrency(stale, CONCURRENCY, async (k) => {
    const key = priceKey(k.region, k.ticker);
    const closes = await fetchHistoricalCloses(toYahooSymbol(k.region, k.ticker), RANGE);
    // An empty result is not cached: one transient failure must not leave a
    // position permanently valued at cost for the next 15 minutes.
    if (Object.keys(closes).length === 0) return;
    cache.set(key, { at: Date.now(), closes });
    out[key] = closes;
  });

  return out;
}
