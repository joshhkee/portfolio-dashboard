import {
  SkeletonBar,
  SkeletonPanel,
  SkeletonPanelPair,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

/**
 * Exposure skeleton. This is the slowest route in the app — it waits on live
 * quotes, FX rates and the stored FX history before it can draw anything — so
 * the placeholder is worth matching closely: two donuts, the P&L split, then
 * the FX table and the tag editor.
 */
export default function LoadingExposure() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonStatus label="Loading exposure" />
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-4 w-72" />
      </div>
      <SkeletonPanelPair bodyClass="h-56" />
      <div className="panel flex flex-col gap-4 p-5">
        <SkeletonBar className="h-3 w-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-5 w-20" />
            </div>
          ))}
        </div>
        <SkeletonTable rows={6} cols={6} />
      </div>
      <SkeletonPanel bodyClass="h-64" />
    </div>
  );
}
