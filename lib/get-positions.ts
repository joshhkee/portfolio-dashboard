import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows, withLivePrices } from "@/lib/portfolio-engine";
import { fetchQuotesForPositions } from "@/lib/prices";
import { fetchFxRates, convertCurrency, type Currency } from "@/lib/fx";

export async function getOpenPositionsFor(regions: string[], displayCurrency: Currency = "USD") {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { openPositions } = computeLedger(fromDbRows(raw));

  const filtered = openPositions.filter((p) => regions.includes(p.region));
  const [prices, rates] = await Promise.all([
    fetchQuotesForPositions(filtered),
    fetchFxRates(),
  ]);
  const withPrices = withLivePrices(filtered, prices);

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