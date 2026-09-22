import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

/**
 * The ledger skeleton. The real row here has 11 columns once you count the
 * Edit/Delete cell, and it scrolls inside its own box, so the placeholder also
 * needs a full complement of columns to reserve the same height.
 */
export default function LoadingTransactions() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus label="Loading transactions" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <SkeletonBar className="h-3 w-32" />
          <SkeletonBar className="h-6 w-28" />
        </div>
        <SkeletonBar className="h-9 w-40 rounded-md" />
      </div>
      <SkeletonTable rows={10} cols={8} />
    </div>
  );
}
