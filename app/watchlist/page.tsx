import { prisma } from "@/lib/prisma";
import { fetchPositionQuotes } from "@/lib/prices";
import { ensureTickerMeta, getNameMap, type TickerMetaEntry } from "@/lib/ticker-meta";
import { watchlistRows } from "@/lib/watchlist";
import WatchlistPanel from "@/components/WatchlistPanel";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const items = await prisma.watchlistItem.findMany({ orderBy: { createdAt: "asc" } });

  // The full quote call, not the prices-only wrapper this page used to make: the
  // same single request per ticker also returns the instrument's name, the
  // latest session's move and a month of closes. A watchlist ticker has never
  // been held, so this is also the only path that puts it in the TickerMeta
  // cache — which is what the command palette reads its names from.
  const quotes = await fetchPositionQuotes(
    items.map((i) => ({ region: i.region, ticker: i.ticker }))
  );
  const metaEntries: TickerMetaEntry[] = [];
  for (const item of items) {
    const meta = quotes.meta[`${item.region}::${item.ticker}`];
    if (meta) metaEntries.push({ region: item.region, ticker: item.ticker, meta });
  }
  await ensureTickerMeta(metaEntries);

  const rows = watchlistRows(
    items.map((i) => ({ id: i.id, region: i.region, ticker: i.ticker, notes: i.notes })),
    quotes,
    await getNameMap()
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-ink-300">Watchlist</p>
        <p className="mt-1 text-2xl font-medium">
          {rows.length} ticker{rows.length === 1 ? "" : "s"}
        </p>
        {/* Says what the page is, because a row here can never show a
            position — you own none of these. */}
        <p className="mt-1 text-xs text-ink-500">
          Tracked, not held. Nothing on this page is in the portfolio.
        </p>
      </div>
      <WatchlistPanel initialRows={rows} />
    </div>
  );
}
