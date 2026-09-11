import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows, withLivePrices } from "@/lib/portfolio-engine";
import { fetchQuotesForPositions } from "@/lib/prices";
import { fetchFxRates, toUSD } from "@/lib/fx";

export async function getOpenPositionsFor(regions: string[]) {
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

  // Convert to USD before computing each row's share of the group total —
  // when a page mixes currencies (SG + HK together), summing native
  // totalHoldings directly would add SGD and HKD as if they were equal.
  const withUSD = withPrices.map((r) => ({
    ...r,
    totalHoldingsUSD: toUSD(r.totalHoldings, r.region, rates),
    unrealizedPLUSD: toUSD(r.unrealizedPL, r.region, rates),
  }));
  const groupTotalUSD = withUSD.reduce((sum, r) => sum + r.totalHoldingsUSD, 0);
  const withPct = withUSD.map((r) => ({
    ...r,
    portfolioPct: groupTotalUSD === 0 ? 0 : r.totalHoldingsUSD / groupTotalUSD,
  }));

  // Highest-value holdings first, matching how you'd scan a positions sheet.
  return withPct.sort((a, b) => b.totalHoldingsUSD - a.totalHoldingsUSD);
}