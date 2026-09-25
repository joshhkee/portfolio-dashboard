import { SkeletonBar, SkeletonSlideDeck, SkeletonStatus, SkeletonTable } from "@/components/Skeleton";

/**
 * Money: the total in the bar, then the deck.
 *
 * Two views now, not three: "By stakeholder" (who paid, with the months their
 * money arrived in underneath) and "Returns by person". The opening slide is the
 * one worth getting right, because it is the one you see — a row of stakeholder
 * cards above the outlay pivot table, which is the SHAPE THE TABLE TAKES, given
 * its own height with `.table-scroll`.
 */
export default function LoadingMoney() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading contributions" />
      <div className="page-bar">
        <div className="flex items-baseline gap-2">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-7 w-40" />
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-7 w-24 rounded-md" />
          <SkeletonBar className="h-7 w-36 rounded-md" />
        </div>
      </div>
      <SkeletonSlideDeck
        tabs={2}
        body={
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="panel flex flex-col gap-2 p-4">
                  <SkeletonBar className="h-3 w-16" />
                  <SkeletonBar className="h-5 w-24" />
                  <SkeletonBar className="h-3 w-10" />
                  <SkeletonBar className="h-1 w-full rounded-full" />
                </div>
              ))}
            </div>
            <SkeletonTable rows={8} cols={6} />
          </div>
        }
      />
    </div>
  );
}
