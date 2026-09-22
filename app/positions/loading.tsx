import {
  SkeletonBar,
  SkeletonStatus,
  SkeletonTable,
} from "@/components/Skeleton";

/**
 * Holdings skeleton: the stat strip, the tab bar, then the positions table.
 * Previously this was a single line of pulsing text, which meant the page grew
 * by several hundred pixels the moment prices landed.
 */
export default function LoadingPositions() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonStatus label="Loading holdings" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel flex flex-col gap-2 p-4">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBar key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      <SkeletonTable rows={8} cols={7} />
    </div>
  );
}
