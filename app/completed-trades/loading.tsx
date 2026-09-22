import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

export default function LoadingCompletedTrades() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus label="Loading completed trades" />
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-28" />
        <SkeletonBar className="h-6 w-32" />
      </div>
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
