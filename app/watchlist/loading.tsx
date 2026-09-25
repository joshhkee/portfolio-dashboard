import { SkeletonBar, SkeletonStatus, SkeletonTable } from "@/components/Skeleton";

/**
 * Watchlist: the count line, then one table of tracked tickers.
 *
 * The table row is two lines (ticker over instrument name) beside a price, a
 * day change and a 1-year range bar — the `.ledger-table` classes give the
 * skeleton those column widths, and the box takes the height the page has left.
 */
export default function LoadingWatchlist() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading watchlist" />
      <div className="page-bar">
        <div className="flex items-baseline gap-2">
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-3 w-40" />
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBar className="h-3 w-48" />
          <SkeletonBar className="h-7 w-32 rounded-md" />
        </div>
        <SkeletonTable rows={8} cols={7} compact />
      </div>
    </div>
  );
}
