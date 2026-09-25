import {
  SkeletonBar,
  SkeletonStatStrip,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

/**
 * Holdings: two inline figures and a search field, then one table per market.
 *
 * The tables are drawn side by side at the same floor the real ones use (the
 * three-across arrangement), each with its own `.table-scroll` filling the
 * height — so the region that scrolls once the prices land is the region that
 * was already there, per market.
 */
export default function LoadingPositions() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading holdings" />
      <SkeletonStatStrip stats={2} />
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3">
        {["US", "SG", "HK"].map((region) => (
          <div key={region} className="flex min-w-0 flex-col gap-2 lg:min-h-0">
            {/* The market heading: a flag-sized square, the region and its
                holding count, and the market's own total on the right. */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <SkeletonBar className="h-3.5 w-4 rounded-sm" />
                <SkeletonBar className="h-3.5 w-24" />
              </span>
              <SkeletonBar className="h-3 w-20" />
            </div>
            <SkeletonTable rows={9} cols={5} />
          </div>
        ))}
      </div>
    </div>
  );
}
