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
    <div className="screen">
      {/* The count and the caveat are one line here rather than two paragraphs,
          and the caveat stays as a CLAUSE rather than becoming a tooltip: a row
          on this page can never show a position, and a reader who mistakes this
          for a holdings list has misunderstood the whole screen. */}
      <div className="page-bar">
        <h1 className="flex items-baseline gap-2 text-sm font-medium text-ink-100">
          Watchlist
          <span className="num text-xs font-normal text-ink-500">
            {rows.length} ticker{rows.length === 1 ? "" : "s"} · tracked, not held
          </span>
        </h1>
      </div>
      <WatchlistPanel initialRows={rows} />
    </div>
  );
}
