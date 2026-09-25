import { SkeletonBar, SkeletonSlideDeck, SkeletonStatus } from "@/components/Skeleton";

/**
 * Returns and risk: the figures on one line, then the deck.
 *
 * There was no loading file for this route at all, so the app fell through to
 * the nearest one above it (the dashboard's) and a navigation here showed a
 * shape that belonged to a different page. It has its own now, and it is the
 * page's own shape: seven inline figures and one panel whose strip says there
 * are **six** views of them — Value, Drawdown, vs index, Risk, Correlation,
 * Calendar years (§7). The count matters: the strip is the widest thing in the
 * head, so promising three pills would move the head when the page landed.
 */
export default function LoadingPerformance() {
  return (
    <div className="screen">
      <SkeletonStatus label="Loading performance" />
      <div className="page-bar">
        <div className="stat-strip">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="flex items-baseline gap-2">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-4 w-12" />
            </span>
          ))}
        </div>
        <SkeletonBar className="h-3 w-52" />
      </div>
      <SkeletonSlideDeck tabs={6} bodyClass="h-72" />
    </div>
  );
}
