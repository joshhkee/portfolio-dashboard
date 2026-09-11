// Live/delayed price fetching.
//
// Uses Yahoo Finance's public chart endpoint, which doesn't require an
// API key. It's an unofficial API (same data source Google Sheets'
// GOOGLEFINANCE draws from) and can occasionally rate-limit or change
// shape — if that becomes a problem, swap fetchQuote() below for a paid
// provider (e.g. Alpha Vantage, Finnhub, Twelve Data) without touching
// anything else in the app.

export interface PriceMap {
  [ticker: string]: number;
}

/** Map a (region, ticker) pair from your ledger to the symbol Yahoo expects. */
export function toYahooSymbol(region: string, ticker: string): string {
  switch (region) {
    case "SG":
      return `${ticker}.SI`;
    case "HK":
      return `${ticker}.HK`;
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
 * Fetch current prices for a set of (region, ticker) positions.
 * Returns a map keyed by ticker (not region+ticker) since the sheet's
 * tickers are unique within your actual holdings — if you ever hold
 * the same symbol in two regions this will need a compound key.
 */
export async function fetchQuotesForPositions(
  positions: { region: string; ticker: string }[]
): Promise<PriceMap> {
  const unique = Array.from(
    new Map(positions.map((p) => [`${p.region}::${p.ticker}`, p])).values()
  );

  const results = await Promise.all(
    unique.map(async (p) => {
      const symbol = toYahooSymbol(p.region, p.ticker);
      const price = await fetchQuote(symbol);
      return { ticker: p.ticker, price };
    })
  );

  const map: PriceMap = {};
  for (const r of results) {
    if (r.price !== null) map[r.ticker] = r.price;
  }
  return map;
}
