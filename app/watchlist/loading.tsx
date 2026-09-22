import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

export default function LoadingWatchlist() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus label="Loading watchlist" />
      <div className="flex items-center justify-between gap-4">
        <SkeletonBar className="h-4 w-64" />
        <SkeletonBar className="h-9 w-36 rounded-md" />
      </div>
      <SkeletonTable rows={5} cols={5} compact />
    </div>
  );
}
