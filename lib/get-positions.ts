import { prisma } from "@/lib/prisma";
import {
  computeLedger,
  fromDbRows,
  withLivePrices,
  type DbTransactionRow,
} from "@/lib/portfolio-engine";
import { fetchPositionQuotes, priceKey, type QuoteMeta } from "@/lib/prices";
import { ensureTickerMeta, getTickerMetaRows, type TickerMetaEntry } from "@/lib/ticker-meta";
import { fetchFxRates, convertCurrency, type Currency, type FxRates } from "@/lib/fx";

/**
 * Open positions with live prices, names and amounts converted to one display
 * currency.
 *
 * `rates` lets a caller that ALSO converts money inject its own snapshot. Two
 * independent `fetchFxRates()` calls inside a single render can return quotes
 * taken moments apart (FX ticks in the fourth decimal), which is enough to make
 * two totals derived from the same positions disagree by a few dollars on the
 * same page — a discrepancy that reads as a bug and is almost impossible to
 * reproduce later. Callers that convert should therefore fetch once and pass
 * it in.
 */
export async function getOpenPositionsFor(
  regions: string[],
  displayCurrency: Currency = "USD",
  rates?: FxRates,
  /** Rows the caller already read. Same idea as `rates`: a page that has the
   *  ledger in hand should pass it rather than make a second identical read —
   *  a round trip to the remote pooler that costs 250-700ms and returns the
   *  rows the caller could have shared. */
  rawTransactions?: DbTransactionRow[]
) {
  const raw =
    rawTransactions ??
    (await prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }));

  const { openPositions } = computeLedger(fromDbRows(raw));

  const filtered = openPositions.filter((p) => regions.includes(p.region));

  // Prices and descriptive metadata come back from the SAME chart call, so
  // this costs exactly what price-only fetching cost before. Cache the
  // metadata (never overwriting a hand-edited name) so subsequent renders
  // need no lookup at all.
  const [quoteData, fxRates, metaRows] = await Promise.all([
    fetchPositionQuotes(filtered),
    rates ? Promise.resolve(rates) : fetchFxRates(),
    getTickerMetaRows(),
  ]);
  const metaEntries: TickerMetaEntry[] = [];
  for (const p of filtered) {
    const meta: QuoteMeta | undefined = quoteData.meta[priceKey(p.region, p.ticker)];
    if (meta) metaEntries.push({ region: p.region, ticker: p.ticker, meta });
  }
  // The rows read above serve both halves: they are what ensureTickerMeta()
  // compares against to decide whether anything needs writing, and they supply
  // the cached names below. Sharing them is the whole point — this path used to
  // do a findUnique AND an upsert per position (36 sequential round trips for
  // an 18-position portfolio, ~13s against the remote pooler, on every render)
  // and read the same table a third time for the names.
  await ensureTickerMeta(metaEntries, metaRows);

  const cachedNames: Record<string, string> = {};
  for (const r of metaRows) {
    if (r.name) cachedNames[priceKey(r.region, r.ticker)] = r.name;
  }

  const withPrices = withLivePrices(filtered, quoteData.prices).map((p) => ({
    ...p,
    // Cached name if we have one, else whatever this fetch reported — the
    // cache write above and this read can race within the same render, so
    // prefer the freshly fetched value when the cache is still empty.
    name:
      cachedNames[priceKey(p.region, p.ticker)] ??
      quoteData.meta[priceKey(p.region, p.ticker)]?.name ??
      null,
    instrumentType: quoteData.meta[priceKey(p.region, p.ticker)]?.instrumentType ?? null,
  }));

  // Convert to a single display currency before computing each row's share
  // of the group total — when a page mixes currencies (or just isn't in
  // that currency natively), summing native totalHoldings directly would
  // add SGD and HKD together as if they were equal.
  const withConverted = withPrices.map((r) => ({
    ...r,
    totalHoldingsConverted: convertCurrency(r.totalHoldings, r.region, displayCurrency, fxRates),
    unrealizedPLConverted: convertCurrency(r.unrealizedPL, r.region, displayCurrency, fxRates),
  }));
  const groupTotalConverted = withConverted.reduce((sum, r) => sum + r.totalHoldingsConverted, 0);
  const withPct = withConverted.map((r) => ({
    ...r,
    portfolioPct: groupTotalConverted === 0 ? 0 : r.totalHoldingsConverted / groupTotalConverted,
  }));

  // Highest-value holdings first, matching how you'd scan a positions sheet.
  return withPct.sort((a, b) => b.totalHoldingsConverted - a.totalHoldingsConverted);
}