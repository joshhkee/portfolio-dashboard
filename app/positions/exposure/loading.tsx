import { SkeletonBar, SkeletonStatus } from "@/components/Skeleton";

/**
 * Exposure: two ring panels on the left, the list that changes them on the right.
 *
 * The left column is the real one now — two cards filling it (`lg:grow` on the
 * wrapper and on each card, §4) rather than one deck, because the page stacks the
 * two cuts it compares and puts the third behind a small toggle. Each card is
 * shaped like a ring card: a head row with the pill track and the hint, then a
 * CIRCLE the size of the donut beside a column of legend lines. The list is the
 * tag editor's shape — two-liner rows, scrolling inside the panel, which is the
 * only thing on this page that grows with the portfolio.
 */
export default function LoadingExposure() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading exposure" />
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col gap-3 lg:grow">
          {[0, 1].map((panel) => (
            <section key={panel} className="panel flex flex-col gap-3 p-4 lg:grow">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="tab-track">
                  <SkeletonBar className="h-5 w-16 rounded" />
                  <SkeletonBar className="h-5 w-14 rounded" />
                </div>
                <SkeletonBar className="h-3 w-40" />
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* The ring: a circle, at the donut's 176px, so the legend column
                    beside it starts at the same x on both sides of the swap. */}
                <div className="h-44 w-44 shrink-0 self-center rounded-full border-8 border-ink-800 sm:self-auto" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <SkeletonBar key={i} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="panel panel-fit min-w-0">
          <div className="panel-head">
            <SkeletonBar className="h-3 w-28" />
            <SkeletonBar className="h-3 w-48" />
          </div>
          <div className="min-h-0 overflow-hidden lg:flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 px-4 py-2">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="h-3 w-32" />
            </div>
            <div className="divide-y divide-ink-700/60">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <SkeletonBar className="h-3.5 w-16" />
                    <SkeletonBar className="h-2.5 w-40" />
                  </div>
                  <SkeletonBar className="h-4 w-24" />
                  <SkeletonBar className="h-1 w-24 rounded-full" />
                  <SkeletonBar className="h-6 w-28 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
