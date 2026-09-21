import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows, withLivePrices } from "@/lib/portfolio-engine";
import { fetchPositionQuotes, priceKey, type QuoteMeta } from "@/lib/prices";
import { ensureTickerMeta, getNameMap, type TickerMetaEntry } from "@/lib/ticker-meta";
import { fetchFxRates, convertCurrency, type Currency } from "@/lib/fx";

export async function getOpenPositionsFor(regions: string[], displayCurrency: Currency = "USD") {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { openPositions } = computeLedger(fromDbRows(raw));

  const filtered = openPositions.filter((p) => regions.includes(p.region));

  // Prices and descriptive metadata come back from the SAME chart call, so
  // this costs exactly what price-only fetching cost before. Cache the
  // metadata (never overwriting a hand-edited name) so subsequent renders
  // need no lookup at all.
  const [quoteData, rates, cachedNames] = await Promise.all([
    fetchPositionQuotes(filtered),
    fetchFxRates(),
    getNameMap(),
  ]);
  const metaEntries: TickerMetaEntry[] = [];
  for (const p of filtered) {
    const meta: QuoteMeta | undefined = quoteData.meta[priceKey(p.region, p.ticker)];
    if (meta) metaEntries.push({ region: p.region, ticker: p.ticker, meta });
  }
  await ensureTickerMeta(metaEntries);

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
    totalHoldingsConverted: convertCurrency(r.totalHoldings, r.region, displayCurrency, rates),
    unrealizedPLConverted: convertCurrency(r.unrealizedPL, r.region, displayCurrency, rates),
  }));
  const groupTotalConverted = withConverted.reduce((sum, r) => sum + r.totalHoldingsConverted, 0);
  const withPct = withConverted.map((r) => ({
    ...r,
    portfolioPct: groupTotalConverted === 0 ? 0 : r.totalHoldingsConverted / groupTotalConverted,
  }));

  // Highest-value holdings first, matching how you'd scan a positions sheet.
  return withPct.sort((a, b) => b.totalHoldingsConverted - a.totalHoldingsConverted);
}