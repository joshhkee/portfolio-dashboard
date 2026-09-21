import { prisma } from "@/lib/prisma";
import { fetchQuotesForPositions } from "@/lib/prices";
import WatchlistPanel from "@/components/WatchlistPanel";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const items = await prisma.watchlistItem.findMany({ orderBy: { createdAt: "asc" } });
  const quotes = await fetchQuotesForPositions(
    items.map((i) => ({ region: i.region, ticker: i.ticker }))
  );

  const rows = items.map((i) => ({
    id: i.id,
    region: i.region,
    ticker: i.ticker,
    notes: i.notes,
    price: quotes[`${i.region}::${i.ticker}`] ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-ink-300">Watchlist</p>
        <p className="mt-1 text-2xl font-medium">{rows.length} ticker{rows.length === 1 ? "" : "s"}</p>
      </div>
      <WatchlistPanel initialRows={rows} />
    </div>
  );
}
