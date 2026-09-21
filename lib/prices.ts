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

export async function fetchQuote(yahooSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooSymbol
      )}`,
      // Revalidate every 60s server-side so repeated page loads don't
      // hammer Yahoo on every request.
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

/**
 * Full company/fund name for a ticker (e.g. "Xiaomi Corporation"), for
 * display only. Uses a different, less reliable Yahoo endpoint than
 * fetchQuote (the chart endpoint doesn't return a name at all) — this
 * one is known to occasionally 401, so treat it as cosmetic and fail
 * silently rather than let a missing name break anything.
 */
export async function fetchCompanyName(yahooSymbol: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data?.quoteResponse?.result?.[0];
    const name = quote?.longName ?? quote?.shortName;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
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
 * Fetch current prices for a set of (region, ticker) positions.
 * Returns a map keyed by compound "REGION::TICKER" (see priceKey) —
 * safe even if the same symbol is held in two regions.
 */
export async function fetchQuotesForPositions(
  positions: { region: string; ticker: string }[]
): Promise<PriceMap> {
  const unique = Array.from(
    new Map(positions.map((p) => [priceKey(p.region, p.ticker), p])).values()
  );

  const results = await Promise.all(
    unique.map(async (p) => {
      const symbol = toYahooSymbol(p.region, p.ticker);
      const price = await fetchQuote(symbol);
      return { key: priceKey(p.region, p.ticker), price };
    })
  );

  const map: PriceMap = {};
  for (const r of results) {
    if (r.price !== null) map[r.key] = r.price;
  }
  return map;
}
