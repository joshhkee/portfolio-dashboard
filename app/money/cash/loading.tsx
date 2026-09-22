import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

export default function LoadingCash() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus label="Loading cash balances" />
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-6 w-36" />
      </div>
      <SkeletonTable rows={4} cols={4} compact />
    </div>
  );
}
