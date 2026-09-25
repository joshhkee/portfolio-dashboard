import { SkeletonBar, SkeletonStatus, SkeletonTable } from "@/components/Skeleton";

/**
 * The ledger: title and count, the filter in the middle, two actions, then the
 * table — and nothing between the bar and the table.
 *
 * Eleven columns, because that is what the real row has (count the Edit/Delete
 * cell) and the column widths come from the real `.ledger-table` — so the
 * placeholder reserves the same width as well as the same height. The bar is the
 * three-zone row the real page draws (`lg:grid-cols-[1fr_auto_1fr]`), so the
 * filter lands where the field was and the table starts where it started.
 */
export default function LoadingTransactions() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading transactions" />
      <div className="page-bar lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex items-baseline gap-2">
          <SkeletonBar className="h-4 w-36" />
          <SkeletonBar className="h-3 w-16" />
        </div>
        <SkeletonBar className="h-8 w-64 rounded-md" />
        <div className="flex items-center gap-2 lg:justify-self-end">
          <SkeletonBar className="h-7 w-24 rounded-md" />
          <SkeletonBar className="h-7 w-36 rounded-md" />
        </div>
      </div>
      <SkeletonTable rows={12} cols={11} />
    </div>
  );
}
