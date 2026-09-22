import {
  SkeletonBar,
  SkeletonHeading,
  SkeletonPanel,
  SkeletonPanelPair,
  SkeletonStatus,
} from "@/components/Skeleton";

/**
 * Overview skeleton. Mirrors the real page's shape — stat row, the portfolio
 * value chart, then the performance / allocation panels — so the layout does
 * not jump when the prices arrive.
 */
export default function LoadingOverview() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonStatus label="Loading overview" />
      <SkeletonHeading />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="panel flex flex-col gap-2 p-4">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-5 w-28" />
          </div>
        ))}
      </div>
      <SkeletonPanel bodyClass="h-64" />
      <SkeletonPanelPair bodyClass="h-40" />
    </div>
  );
}
