import {
  SkeletonHeading,
  SkeletonPanel,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

export default function LoadingOutlay() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonStatus label="Loading outlay" />
      <SkeletonHeading />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonPanel bodyClass="h-48" />
        <SkeletonPanel bodyClass="h-48" />
      </div>
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
