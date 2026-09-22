// Live/delayed price fetching.
//
// Uses Yahoo Finance's public chart endpoint, which doesn't require an
// API key. It's an unofficial API (same data source Google Sheets'
// GOOGLEFINANCE draws from) and can occasionally rate-limit or change
// shape — if that becomes a problem, swap fetchQuote() below for a paid
// provider (e.g. Alpha Vantage, Finnhub, Twelve Data) without touching
// anything else in the app.

/** Prices are keyed by "REGION::TICKER" (compound key) — a ticker
 * alone is NOT unique: the same symbol can legitimately be held in two
 * regions (e.g. a US-listed ETF and an SG-listed fund sharing a name),
 * and a ticker-only map would silently collapse them into one price. */
export function priceKey(region: string, ticker: string): string {
  return `${region}::${ticker}`;
}

export interface PriceMap {
  [compoundKey: string]: number;
}

/** Map a (region, ticker) pair from your ledger to the symbol Yahoo expects. */
export function toYahooSymbol(region: string, ticker: string): string {
  switch (region) {
    case "SG":
      return `${ticker}.SI`;
    case "HK": {
      // Yahoo expects HK codes zero-padded to exactly 4 digits (e.g.
      // "0700.HK" for Tencent, "1810.HK" for Xiaomi) — stripping to the
      // numeric value and re-padding handles both a 5-digit code with an
      // extra leading zero and a plain 3-digit code correctly, matching
      // Yahoo's actual convention either way.
      const numeric = Number(ticker);
      const padded = Number.isFinite(numeric) ? String(numeric).padStart(4, "0") : ticker;
      return `${padded}.HK`;
    }
    default:
      return ticker; // US tickers are used as-is
  }
}

/**
 * Everything we read out of a chart-endpoint response. The chart endpoint
 * returns the instrument's name, type, exchange and currency in the same
 * `meta` block as the price — so a single call per ticker yields both the
 * quote and the descriptive fields, and the app never needs a second
 * endpoint for names.
 */
export interface QuoteMeta {
  price: number | null;
  name: string | null;
  instrumentType: string | null;
  exchange: string | null;
  currency: string | null;
  /**
   * The latest session's move, as a FRACTION despite the source's name: Yahoo
   * reports `regularMarketChangePercent` in percent units (0.569 means +0.569%),
   * and every other rate in this app is a fraction (see `unrealizedPLPct`), so
   * the divide-by-100 happens once, here, where the payload is known.
   *
   * Deliberately NOT derived from `chartPreviousClose`: that field is the close
   * BEFORE the requested window, so with the default range it is the close from
   * a month ago and "today's move" computed from it would be a month's move.
   * The reported field is the honest one, and null when the source omits it.
   */
  dayChangePct: number | null;
}

/**
 * Pure parser for a chart-endpoint payload. Exported so it can be tested
 * against real response shapes without a network call.
 *
 * `longName` is preferred over `shortName` because the short form is often
 * an abbreviated trading name; both are absent for some symbols (notably
 * FX pairs like "SGD=X"), which is why every field is nullable rather than
 * assumed present.
 */
export function parseChartMeta(data: unknown): QuoteMeta | null {
  const meta = (data as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart
    ?.result?.[0]?.meta;
  if (!meta) return null;

  const rawName = meta.longName ?? meta.shortName;
  const name = typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : null;

  const rawChange = meta.regularMarketChangePercent;
  const dayChangePct =
    typeof rawChange === "number" && Number.isFinite(rawChange) ? rawChange / 100 : null;

  return {
    price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
    name,
    instrumentType: typeof meta.instrumentType === "string" ? meta.instrumentType : null,
    exchange: typeof meta.fullExchangeName === "string" ? meta.fullExchangeName : null,
    currency: typeof meta.currency === "string" ? meta.currency : null,
    dayChangePct,
  };
}

/**
 * One chart-endpoint call, returning the price plus the descriptive fields.
 *
 * This replaces the old fetchCompanyName(), which called Yahoo's v7 quote
 * endpoint. That endpoint now returns 401 for unauthenticated callers, so
 * every name lookup silently failed and the UI fell back to bare tickers —
 * while the chart endpoint it already depends on was returning `longName`
 * and `instrumentType` the whole time. Reading them here removes a network
 * call per ticker instead of adding one.
 */
export async function fetchQuoteMeta(yahooSymbol: string): Promise<QuoteMeta | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
      // Revalidate every 60s server-side so repeated page loads don't
      // hammer Yahoo on every request.
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return parseChartMeta(await res.json());
  } catch {
    return null;
  }
}

/** Just the price. Thin delegate over fetchQuoteMeta so every caller shares
 * one code path (and one cache entry) for a given symbol. */
export async function fetchQuote(yahooSymbol: string): Promise<number | null> {
  return (await fetchQuoteMeta(yahooSymbol))?.price ?? null;
}

export interface HistoricalCloses {
  /** Map of "YYYY-MM-DD" (UTC calendar day) -> closing price. */
  [date: string]: number;
}

/**
 * Daily closing prices for a symbol over a date range, from the same
 * Yahoo chart endpoint fetchQuote uses (its range/interval params
 * return historical bars). Keys are UTC "YYYY-MM-DD" strings. Returns
 * an empty map on failure — history is cosmetic-adjacent data and the
 * snapshot series tolerates missing days.
 */
export async function fetchHistoricalCloses(
  yahooSymbol: string,
  range: string
): Promise<HistoricalCloses> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol
      )}?range=${encodeURIComponent(range)}&interval=1d`,
      { next: { revalidate: 3600 } } // historical bars don't change; cache a while
    );
    if (!res.ok) return {};
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] | undefined = result?.timestamp;
    const closes: (number | null)[] | undefined =
      result?.indicators?.quote?.[0]?.close;
    const map: HistoricalCloses = {};
    if (!timestamps || !closes) return map;
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (typeof close !== "number") continue;
      const day = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      map[day] = close;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * One close per requested date, carrying the previous close forward.
 *
 * Yahoo series are trading-day only while DailySnapshot rows are
 * calendar-daily, so an exact-date lookup would leave every weekend and
 * holiday as a hole. Carrying the last close forward keeps two series the
 * same length and index-aligned — which matters wherever they are paired
 * positionally (the benchmark regression, the correlation matrix).
 *
 * Dates before the series has any data yield null rather than the first
 * later close, so a window that starts earlier than the series (or a symbol
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

/** Descriptive fields per compound "REGION::TICKER" key. */
export interface MetaMap {
  [compoundKey: string]: QuoteMeta;
}

/** Latest-session change per compound "REGION::TICKER" key, as a fraction. */
export interface DayChangeMap {
  [compoundKey: string]: number;
}

/**
 * Current price AND descriptive metadata for a set of (region, ticker)
 * positions, in one pass — the chart endpoint returns both from a single
 * request, so fetching them together costs exactly what fetching prices
 * alone used to cost.
 *
 * Both maps are keyed by compound "REGION::TICKER" (see priceKey) so the
 * same symbol held in two regions can't collide.
 */
export async function fetchPositionQuotes(
  positions: { region: string; ticker: string }[]
): Promise<{ prices: PriceMap; meta: MetaMap; dayChanges: DayChangeMap }> {
  const unique = Array.from(
    new Map(positions.map((p) => [priceKey(p.region, p.ticker), p])).values()
  );

  const results = await Promise.all(
    unique.map(async (p) => {
      const key = priceKey(p.region, p.ticker);
      const meta = await fetchQuoteMeta(toYahooSymbol(p.region, p.ticker));
      return { key, meta };
    })
  );

  const prices: PriceMap = {};
  const meta: MetaMap = {};
  const dayChanges: DayChangeMap = {};
  for (const r of results) {
    if (!r.meta) continue;
    if (r.meta.price !== null) prices[r.key] = r.meta.price;
    if (r.meta.dayChangePct !== null) dayChanges[r.key] = r.meta.dayChangePct;
    meta[r.key] = r.meta;
  }
  return { prices, meta, dayChanges };
}


