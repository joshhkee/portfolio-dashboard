/**
 * Loading placeholders.
 *
 * Next streams a route's `loading.tsx` the instant a navigation starts, so
 * these are the first thing you see on every page here. Their job is to hold
 * the layout still: each skeleton mirrors the real grid's shape, so when the
 * numbers land they fill the space that was already reserved instead of
 * shoving it around. That is why these are shaped like the content (a table
 * with the right number of columns, panels at the right height) rather than
 * one generic centred spinner.
 *
 * `motion-reduce:animate-none` is not decoration. A pulsing block is the only
 * animation on this site that loops forever, and a reader who has asked the OS
 * for reduced motion has usually asked because that kind of motion is
 * genuinely unpleasant. A static block says the same thing — "this is still
 * coming" — with the movement removed.
 */

const PULSE = "animate-pulse rounded bg-ink-800 motion-reduce:animate-none";

export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`${PULSE} ${className}`.trim()} />;
}

/** Page header: eyebrow, title, and optionally a button on the right. */
export function SkeletonHeading({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-6 w-44" />
      </div>
      {action && <SkeletonBar className="h-9 w-28 rounded-md" />}
    </div>
  );
}

/**
 * A table-shaped placeholder.
 *
 * Rendered with the real `.ledger-table` / `.table-scroll` classes on purpose:
 * it inherits the same column widths, borders, sticky header AND height — since
 * `.table-scroll` now takes `flex-1` from `lg`, this box is the same size in the
 * skeleton and in the loaded page, so the swap to real rows is invisible apart
 * from the numbers appearing. It has to be given a bounded parent to do that
 * (`.screen` or `.panel-fit`); on its own it keeps the 70vh cap the narrow
 * breakpoints use.
 *
 * It is also the whole of a full-page table route now. There used to be a
 * `SkeletonTableBlock` that wrapped this with the count-and-filter head row
 * above it; the filter moved into the page bar (§7), so the head row is gone and
 * a page whose only content is a table renders this directly as a child of
 * `.screen`.
 */
export function SkeletonTable({
  rows = 6,
  cols = 5,
  compact = false,
}: {
  rows?: number;
  cols?: number;
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className={compact ? "ledger-table table-compact" : "ledger-table"}>
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c}>
                <SkeletonBar className="h-3 w-14" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                  <SkeletonBar className={c === 0 ? "h-4 w-20" : "h-4 w-12"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The page bar: the inline figures a page opens with, and its one control.
 *
 * This is the shape every page now starts with (`.page-bar` + `.stat-strip`),
 * so it is the shape a skeleton has to hold — the bar is 30px here and 30px
 * there, and the region below it gets the rest of the screen either way.
 */
export function SkeletonStatStrip({
  stats = 2,
  control = true,
}: {
  stats?: number;
  control?: boolean;
}) {
  return (
    <div className="page-bar">
      <div className="stat-strip">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-5 w-24" />
          </div>
        ))}
      </div>
      {control && <SkeletonBar className="h-8 w-64 rounded-md" />}
    </div>
  );
}

/**
 * A slide deck: the tab strip in the panel head and the body below it.
 *
 * `tabs` is not a cosmetic knob — the strip's WIDTH is what the real one will
 * be, so a page with six views (performance, after returns-and-risk was split)
 * has to promise six pills or the head jumps when the page lands. Same for
 * `body`: one block by default, because only one slide is ever visible and a
 * skeleton that drew three stacked panels would be promising a layout the page
 * does not have — but a deck whose opening slide is a row of cards over a table
 * (money) draws that instead.
 *
 * The track is the real `.tab-track`, so the pills land in the boxes the
 * skeleton made rather than beside them.
 */
export function SkeletonSlideDeck({
  bodyClass = "h-64",
  tabs = 3,
  body,
}: {
  bodyClass?: string;
  tabs?: number;
  body?: React.ReactNode;
}) {
  return (
    <section className="panel panel-fit">
      <div className="panel-head">
        <div className="tab-track">
          {Array.from({ length: tabs }, (_, i) => (
            <SkeletonBar key={i} className="h-5 w-16 rounded" />
          ))}
        </div>
        <SkeletonBar className="h-3 w-40" />
      </div>
      <div className="panel-body p-4">
        {body ?? <SkeletonBar className={`${bodyClass} w-full`} />}
      </div>
    </section>
  );
}

/** One bordered panel with a label line and a body of the given height. */
export function SkeletonPanel({
  bodyClass = "h-32",
  className = "",
}: {
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`panel flex flex-col gap-4 p-5 ${className}`.trim()}>
      <SkeletonBar className="h-3 w-28" />
      <SkeletonBar className={`${bodyClass} w-full`} />
    </div>
  );
}

/** Two panels side by side, matching the app's `lg:grid-cols-2` layouts. */
export function SkeletonPanelPair({
  bodyClass = "h-32",
}: {
  bodyClass?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SkeletonPanel bodyClass={bodyClass} />
      <SkeletonPanel bodyClass={bodyClass} />
    </div>
  );
}

/**
 * The screen-reader announcement. Visual skeletons are `aria-hidden`, which
 * leaves a screen-reader user with a page that silently does nothing, so every
 * loading route renders this once.
 */
export function SkeletonStatus({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}…
    </p>
  );
}
