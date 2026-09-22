// 30-day sparkline series for the positions tables.
//
// One constraint shapes this module: a positions page renders ~18 rows, so
// fetching per row would be an 18-request waterfall per view. Instead the
// table asks a single endpoint for every row at once (see
// app/api/sparklines/route.ts), and this module keeps that cheap:
//
//  - a process-level TTL cache, so moving between the US/SG/HK pages doesn't
//    re-fetch tickers they share, and
//  - bounded concurrency, so a cold cache doesn't open 18 sockets to Yahoo at
//    the same instant.
//
// fetchHistoricalCloses already sits behind Next's own fetch cache (1h), so a
// repeat inside the hour is served from memory anyway; the cache here also
// covers the shaping (an ascending array per ticker) and the cap below.

import { fetchHistoricalCloses, priceKey, toYahooSymbol } from "@/lib/prices";

export const SPARKLINE_RANGE = "1mo";

/** How long a shaped sparkline series is reused before asking again. */
const TTL_MS = 15 * 60 * 1000;

/** Yahoo requests in flight at once. Enough to be quick on a cold cache,
 * few enough to not look like a scraper. */
const CONCURRENCY = 4;

/** Hard cap on symbols per request, so a malformed query can't ask for
 * thousands of tickers. Comfortably above the ~20 positions the app has. */
export const MAX_SPARKLINE_KEYS = 60;

const cache = new Map<string, { at: number; data: number[] }>();

export interface SparklineKey {
  region: string;
  ticker: string;
}

/**
 * Run an async mapper with at most `limit` promises in flight, resolving to
 * results in the input order. Small enough not to justify a dependency.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Ascending close values per compound "REGION::TICKER" key.
 *
 * Tickers with no usable history are simply absent from the result rather
 * than present-but-empty, so the UI can skip a sparkline cell instead of
 * drawing a flat line for data it doesn't have. As with prices, a bare
 * ticker is not unique across regions, hence the compound key.
 */
export async function getSparklines(keys: SparklineKey[]): Promise<Record<string, number[]>> {
  const unique = new Map<string, SparklineKey>();
  for (const k of keys) {
    if (!k.region || !k.ticker) continue;
    unique.set(priceKey(k.region, k.ticker), k);
  }

  const out: Record<string, number[]> = {};
  const stale: SparklineKey[] = [];
  for (const [key, k] of unique) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) out[key] = hit.data;
    else stale.push(k);
  }

  await mapWithConcurrency(stale, CONCURRENCY, async (k) => {
    const key = priceKey(k.region, k.ticker);
    const closes = await fetchHistoricalCloses(toYahooSymbol(k.region, k.ticker), SPARKLINE_RANGE);
    // Keys are "YYYY-MM-DD", so a lexical sort is chronological; the chart
    // needs oldest → newest.
    const data = Object.keys(closes)
      .sort()
      .map((day) => closes[day]);
    // A single point isn't a trend, and caching it would hide the fact that
    // the fetch came back partial.
    if (data.length >= 2) {
      cache.set(key, { at: Date.now(), data });
      out[key] = data;
    }
  });

  return out;
}

export interface SparklineTrend {
  change: number;
  /** Fractional change over the window, e.g. 0.032 for +3.2%. */
  changePct: number;
  direction: "up" | "down" | "flat";
}

/** First-to-last change over the window, or null when there's no trend to show. */
export function trendOf(values: number[]): SparklineTrend | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  return {
    change,
    changePct: first === 0 ? 0 : change / first,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * An SVG polyline `points` string for the values, scaled to the given box.
 *
 * Deliberately hand-rolled rather than a chart library: a sparkline is one
 * polyline per row, and mounting ~18 chart components (each with its own
 * ResizeObserver) is far more expensive than a string of coordinates. There
 * is no animation either, so `prefers-reduced-motion` needs no special case.
 *
 * A flat series (no range) is drawn on the middle line instead of dividing
 * by zero and collapsing to the bottom.
 */
export function toSparklinePoints(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = width / (values.length - 1);
  const pad = 1; // keep the 1px stroke inside the viewBox

  return values
    .map((value, i) => {
      const norm = span === 0 ? 0.5 : (value - min) / span;
      const x = i * stepX;
      const y = pad + (1 - norm) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
