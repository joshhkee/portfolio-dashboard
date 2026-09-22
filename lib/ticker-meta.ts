// Instrument reference data (company/fund name, type, exchange) — cache in
// front of the Yahoo chart endpoint.
//
// Why this exists: names used to be fetched from Yahoo's v7 quote endpoint,
// which now 401s for unauthenticated callers, so every lookup silently failed
// and the UI showed bare tickers. The chart endpoint the app already calls for
// prices returns longName/instrumentType in the same response, so names are
// effectively free — but they still shouldn't be re-fetched on every render,
// hence a small cache table.
//
// Everything here is descriptive only. It never affects prices, positions, or
// any figure derived from the ledger.

import { prisma } from "@/lib/prisma";
import {
  fetchPositionQuotes,
  fetchQuoteMeta,
  priceKey,
  toYahooSymbol,
  type QuoteMeta,
} from "@/lib/prices";

export interface TickerMetaEntry {
  region: string;
  ticker: string;
  meta: QuoteMeta;
}

export interface ExistingMeta {
  name: string | null;
  nameOverridden: boolean;
}

/** A stored reference row, with the fields the write decision depends on. */
export interface StoredMeta extends ExistingMeta {
  region: string;
  ticker: string;
  instrumentType: string | null;
  exchange: string | null;
  currency: string | null;
}

/**
 * Every cached reference row, in one read.
 *
 * This table is small (one row per instrument ever seen, ~27 here), so reading
 * all of it is cheaper than any per-instrument lookup — and it is what lets
 * ensureTickerMeta() decide what to write without asking the database once per
 * position.
 */
export async function getTickerMetaRows(): Promise<StoredMeta[]> {
  return prisma.tickerMeta.findMany({
    select: {
      region: true,
      ticker: true,
      name: true,
      nameOverridden: true,
      instrumentType: true,
      exchange: true,
      currency: true,
    },
  });
}

/**
 * Pure: does writing `merged` over `stored` change anything a reader can see?
 *
 * Deliberately ignores `fetchedAt`. That field exists to say when the data was
 * last checked, so treating it as a reason to write turns every render into a
 * write, which is exactly the cost this avoids.
 */
export function metaIsUnchanged(
  stored: StoredMeta,
  merged: Pick<StoredMeta, "name" | "nameOverridden" | "instrumentType" | "exchange" | "currency">
): boolean {
  return (
    stored.name === merged.name &&
    stored.nameOverridden === merged.nameOverridden &&
    stored.instrumentType === merged.instrumentType &&
    stored.exchange === merged.exchange &&
    stored.currency === merged.currency
  );
}

/**
 * Pure: decide what to persist for one instrument.
 *
 * A hand-edited name always wins — that's the whole point of the override, and
 * a background refresh silently reverting the owner's correction would be
 * worse than showing nothing. Auto-lookup fills blanks, and prefers the newly
 * fetched name only when the owner hasn't intervened.
 */
export function mergeMeta(existing: ExistingMeta | null, incoming: QuoteMeta) {
  const nameOverridden = existing?.nameOverridden ?? false;
  return {
    name: nameOverridden ? existing!.name : incoming.name ?? existing?.name ?? null,
    instrumentType: incoming.instrumentType,
    exchange: incoming.exchange,
    currency: incoming.currency,
    nameOverridden,
  };
}

/**
 * Every cached name AND exposure tag, in one DB read with no network calls —
 * safe to call on any render path.
 *
 * Both maps are keyed by compound "REGION::TICKER" and both omit blank values,
 * so a caller can treat "absent" as "not known" rather than having to test for
 * empty strings. Empty maps rather than nulls when a category is entirely
 * unpopulated, which keeps call sites free of null checks.
 */
export async function getTickerMetaMaps(): Promise<{
  names: Record<string, string>;
  sectors: Record<string, string>;
}> {
  const rows = await prisma.tickerMeta.findMany({
    select: { region: true, ticker: true, name: true, sector: true },
  });
  const names: Record<string, string> = {};
  const sectors: Record<string, string> = {};
  for (const r of rows) {
    const key = priceKey(r.region, r.ticker);
    if (r.name) names[key] = r.name;
    if (r.sector) sectors[key] = r.sector;
  }
  return { names, sectors };
}

/** Just the names. Thin delegate so existing callers are unaffected. */
export async function getNameMap(): Promise<Record<string, string>> {
  return (await getTickerMetaMaps()).names;
}

/**
 * Hand-tag an instrument's exposure (sector / asset class).
 *
 * Deliberately NOT part of the auto-lookup path: no free data source
 * classifies these instruments, so this value is only ever set by the owner.
 * Passing a blank tag clears it back to "unclassified" rather than storing an
 * empty string, so the exposure breakdown can report what is genuinely
 * unknown. A blank upsert must not create a row out of nothing, hence the
 * existence check.
 */
export async function setTickerSector(
  region: string,
  ticker: string,
  sector: string | null
): Promise<void> {
  const trimmed = sector?.trim().replace(/\s+/g, " ") || null;
  if (trimmed === null) {
    await prisma.tickerMeta.updateMany({
      where: { region, ticker },
      data: { sector: null },
    });
    return;
  }
  await prisma.tickerMeta.upsert({
    where: { region_ticker: { region, ticker } },
    update: { sector: trimmed },
    create: { region, ticker, sector: trimmed },
  });
}

/**
 * Persist freshly fetched metadata, respecting overrides. Called from the
 * holdings path, which already has this data in hand from the price call —
 * so caching it costs no extra network request.
 *
 * Only the fetched fields are written, so `sector` — which is hand-entered and
 * never auto-derived — survives every refresh untouched.
 */
export async function ensureTickerMeta(
  entries: TickerMetaEntry[],
  /** Rows the caller already read (see getTickerMetaRows). Passing them in is
   *  what keeps the steady-state cost of this function at zero queries. */
  knownRows?: StoredMeta[]
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const stored = knownRows ?? (await getTickerMetaRows());
    const byKey = new Map(stored.map((r) => [priceKey(r.region, r.ticker), r]));

    const writes = [];
    for (const { region, ticker, meta } of entries) {
      const existing = byKey.get(priceKey(region, ticker)) ?? null;
      const merged = mergeMeta(existing, meta);
      // Nothing to write when every field already matches. Without this the
      // loop wrote 18 rows on every render just to restate what they said,
      // and `fetchedAt` alone made "unchanged" look like a change.
      if (existing && metaIsUnchanged(existing, merged)) continue;
      writes.push(
        prisma.tickerMeta.upsert({
          where: { region_ticker: { region, ticker } },
          update: { ...merged, fetchedAt: new Date() },
          create: { region, ticker, ...merged, fetchedAt: new Date() },
        })
      );
    }
    await Promise.all(writes);
  } catch {
    // Reference data is cosmetic — never let it break a page render.
  }
}

/**
 * Fill in names for any of these positions that aren't cached yet.
 *
 * Needed because the holdings path only ever sees OPEN positions — a ticker
 * that was fully sold is never refreshed there, so it would sit name-less in
 * the ledger forever. This closes that gap: one bounded lookup per unseen
 * ticker, then the cache answers every later render with no network call.
 * Tickers already cached are skipped entirely, so this is a no-op in the
 * steady state.
 */
export async function ensureNamesFor(
  positions: { region: string; ticker: string }[]
): Promise<void> {
  const unique = Array.from(
    new Map(positions.map((p) => [priceKey(p.region, p.ticker), p])).values()
  );
  if (unique.length === 0) return;

  try {
    const cached = await prisma.tickerMeta.findMany({
      select: { region: true, ticker: true, name: true },
    });
    const haveName = new Set(
      cached.filter((r) => r.name).map((r) => priceKey(r.region, r.ticker))
    );
    const missing = unique.filter((p) => !haveName.has(priceKey(p.region, p.ticker)));
    if (missing.length === 0) return;

    const { meta } = await fetchPositionQuotes(missing);
    const entries: TickerMetaEntry[] = [];
    for (const p of missing) {
      const m = meta[priceKey(p.region, p.ticker)];
      if (m) entries.push({ region: p.region, ticker: p.ticker, meta: m });
    }
    await ensureTickerMeta(entries);
  } catch {
    // Reference data only — never let it break a page render.
  }
}

/**
 * Name for one instrument, fetching and caching on a cache miss. Used by the
 * transaction-history route, which is reached from a single position and so
 * can afford one lookup.
 */
export async function resolveName(region: string, ticker: string): Promise<string | null> {
  const cached = await prisma.tickerMeta
    .findUnique({
      where: { region_ticker: { region, ticker } },
      select: { name: true },
    })
    .catch(() => null);
  if (cached?.name) return cached.name;

  const meta = await fetchQuoteMeta(toYahooSymbol(region, ticker));
  if (!meta) return null;
  await ensureTickerMeta([{ region, ticker, meta }]);
  return meta.name ?? null;
}

/**
 * Hand-edit a name. Sets `nameOverridden` so no future fetch overwrites it.
 * Passing an empty name clears both the name and the override, handing the
 * instrument back to auto-lookup.
 */
export async function setTickerNameOverride(
  region: string,
  ticker: string,
  name: string | null
): Promise<void> {
  const trimmed = name?.trim() || null;
  await prisma.tickerMeta.upsert({
    where: { region_ticker: { region, ticker } },
    update: { name: trimmed, nameOverridden: trimmed !== null },
    create: { region, ticker, name: trimmed, nameOverridden: trimmed !== null },
  });
}
