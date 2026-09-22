import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

export default function LoadingAttribution() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonStatus label="Loading attribution" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-6 w-40" />
        </div>
        <SkeletonBar className="h-8 w-56 rounded-md" />
      </div>
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
