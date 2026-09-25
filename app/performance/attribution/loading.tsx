import { SkeletonBar, SkeletonStatus, SkeletonTable } from "@/components/Skeleton";

/**
 * Attribution: two control groups, the summary pair, then the grid that takes
 * whatever height is left. No scope line above them and no footnote below: that
 * row of prose is gone from the page (§8.7) and the band it occupied belongs to
 * the grid.
 *
 * That grid is the reason this skeleton matters more here than elsewhere: it
 * grows a column per month, so its scrollbar is expected — what must not happen
 * is the summary above it moving once the figures arrive.
 */
export default function LoadingAttribution() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading attribution" />
      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <SkeletonBar className="h-7 w-44 rounded-md" />
          <SkeletonBar className="h-7 w-56 rounded-md" />
        </div>
        <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="panel flex flex-col gap-2 p-5 lg:col-span-2">
            <SkeletonBar className="h-3 w-40" />
            <SkeletonBar className="h-7 w-40" />
            <SkeletonBar className="h-3 w-72" />
          </div>
          <div className="panel flex flex-col gap-2 p-5">
            <SkeletonBar className="h-3 w-32" />
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBar key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
        <SkeletonTable rows={8} cols={10} compact />
      </div>
    </div>
  );
}
