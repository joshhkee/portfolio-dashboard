import { SkeletonBar, SkeletonStatus, SkeletonTable } from "@/components/Skeleton";

/**
 * Realized trades: one figure and a count in the bar, the filter in the middle,
 * the export on the right, then the table.
 *
 * The figure is inline at the bar's text size rather than a `text-3xl`
 * headline, which is what this skeleton used to promise — that mismatch is why
 * the page used to jump upward by ~90px when the trades landed. The bar is the
 * real three-zone row, so the field lands where the search box was instead of on
 * a band of its own that no longer exists.
 */
export default function LoadingRealized() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading realized trades" />
      <div className="page-bar lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex items-baseline gap-2">
          <SkeletonBar className="h-3 w-40" />
          <SkeletonBar className="h-6 w-32" />
          <SkeletonBar className="h-3 w-16" />
        </div>
        <SkeletonBar className="h-8 w-64 rounded-md" />
        <div className="flex items-center gap-2 lg:justify-self-end">
          <SkeletonBar className="h-7 w-24 rounded-md" />
        </div>
      </div>
      <SkeletonTable rows={10} cols={10} />
    </div>
  );
}
