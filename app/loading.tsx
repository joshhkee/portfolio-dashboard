import { SkeletonBar, SkeletonStatus } from "@/components/Skeleton";

/**
 * Today's skeleton, matching the page box for box.
 *
 * The layout it has to hold is: the bar, three columns of which the value panel
 * takes two and the movers panel one, a full-width deposit line, then a row
 * where the chart takes three fifths and the largest positions two. Each of
 * those regions is a real element here with the same classes as the real one,
 * because "the skeleton holds the layout still" only works if the skeleton is
 * the same shape (components/Skeleton.tsx says the same thing at the top).
 *
 * No prose bars: this page has none left outside the panels, so a pulsing line
 * standing in for a sentence would be the one thing that DID move when the data
 * arrived.
 */
export default function LoadingToday() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading dashboard" />
      <div className="page-bar">
        <div className="flex items-baseline gap-2">
          <SkeletonBar className="h-4 w-12" />
          <SkeletonBar className="h-3 w-40" />
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-7 w-32 rounded-md" />
          <SkeletonBar className="h-7 w-32 rounded-md" />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel flex flex-col gap-3 p-4 lg:col-span-2">
          <SkeletonBar className="h-3 w-56" />
          <SkeletonBar className="h-10 w-64" />
          <SkeletonBar className="h-5 w-40" />
          <div className="mt-auto flex gap-8 border-t border-ink-700 pt-4">
            <SkeletonBar className="h-4 w-48" />
            <SkeletonBar className="h-4 w-48" />
          </div>
        </div>
        <div className="panel flex flex-col gap-3 p-4">
          <SkeletonBar className="h-3 w-32" />
          <div className="grid grid-cols-2 gap-x-4">
            {Array.from({ length: 2 }, (_, col) => (
              <div key={col} className="flex flex-col gap-1.5">
                <SkeletonBar className="h-2.5 w-14" />
                {Array.from({ length: 3 }, (_, r) => (
                  <SkeletonBar key={r} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel flex shrink-0 items-center gap-3 px-4 py-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-3 w-56" />
        <SkeletonBar className="ml-auto h-3 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-5">
        <div className="panel flex min-h-0 flex-col gap-3 p-4 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <SkeletonBar className="h-3 w-40" />
            <SkeletonBar className="h-6 w-48 rounded-md" />
          </div>
          <SkeletonBar className="min-h-0 w-full flex-1" />
        </div>
        <div className="panel flex min-h-0 flex-col gap-3 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <SkeletonBar className="h-3 w-32" />
            <SkeletonBar className="h-3 w-16" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <SkeletonBar className="h-3.5 w-16" />
                <SkeletonBar className="h-2.5 w-28" />
              </div>
              <SkeletonBar className="h-4 w-24" />
              <SkeletonBar className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
