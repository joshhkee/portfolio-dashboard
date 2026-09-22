// The watchlist's rows: an instrument you are not holding, plus what the quote
// pipeline knows about it.
//
// Pure and shared on purpose. The page and the 60-second refresh route must
// agree on what a row contains — a name resolved one way on the server and
// another way on refresh is how a row starts flickering between a real name and
// a bare ticker. One function, so there is one answer.
//
// Nothing here is stored. `WatchlistItem` holds the pair and the owner's note;
// the price, the resolved name and today's move are derived from the fetch the
// holdings path already uses (`fetchPositionQuotes`), whose payload carries all
// three for the price of one call. The 30-day trend is NOT part of this: that
// payload's bars are the current session's MINUTES — measured, 299 of them, all
// stamped with today's date — so the trend comes from `/api/sparklines` instead,
// which asks for `range=1mo&interval=1d` explicitly.

import { priceKey, type DayChangeMap, type MetaMap, type PriceMap } from "@/lib/prices";

export interface WatchlistItemRow {
  id: number;
  region: string;
  ticker: string;
  /** The owner's reason for watching it. Never the instrument's name — that
   *  comes from the lookup and renders under the ticker. */
  notes: string | null;
}

export interface WatchlistRow extends WatchlistItemRow {
  /** Resolved display name, or null when the lookup has nothing. */
  name: string | null;
  price: number | null;
  /** Latest session's move, as a fraction. */
  dayChangePct: number | null;
}

export function watchlistRows(
  items: WatchlistItemRow[],
  quotes: { prices: PriceMap; meta: MetaMap; dayChanges: DayChangeMap },
  /** Names from the TickerMeta cache, keyed by compound key. A cached name wins
   *  because it may be hand-edited — the same precedence the holdings path
   *  uses. */
  cachedNames: Record<string, string> = {}
): WatchlistRow[] {
  return items.map((item) => {
    const key = priceKey(item.region, item.ticker);
    return {
      ...item,
      notes: item.notes?.trim() || null,
      name: cachedNames[key] ?? quotes.meta[key]?.name ?? null,
      price: quotes.prices[key] ?? null,
      dayChangePct: quotes.dayChanges[key] ?? null,
    };
  });
}
