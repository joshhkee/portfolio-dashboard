"use client";

import { useId, useState } from "react";
import { useSlidingPill } from "@/lib/use-sliding-pill";

export interface Slide {
  /** The strip's label for this slide — "By sector", "Risk", "Outlay history". */
  label: string;
  /** One clause on the right of the strip saying what the slide is showing. */
  hint?: string;
  /** A control the slide owns, rendered beside the hint — the performance
   *  deck's shared time range, which applies to its three chart slides and to
   *  nothing else, so it travels with the slides it drives rather than sitting
   *  over the whole panel claiming to affect all six. */
  actions?: React.ReactNode;
  /** The slide itself. */
  content: React.ReactNode;
}

/**
 * One slot, several views of it.
 *
 * Three pages had grown a column of tall panels stacked downward — performance's
 * returns chart above the risk panel above the calendar-year table, `/money`'s
 * stakeholder breakdown above the per-stakeholder performance above the outlay
 * pivot, exposure's sector donut above the type donut above the currency donut.
 * Each of those panels wants the same thing (as much height as it can get, since
 * a chart with 300px of width and 200px of height is a squashed chart), and
 * stacking them means the page is as tall as all of them while only one is
 * really being read.
 *
 * So they share a slot and a switch. The result on a desktop is that the panel
 * is 500px tall instead of 200px, and nothing below it was pushed off the
 * screen — which is the point of the one-screen rule in docs/DESIGN.md §4.
 *
 * Four decisions worth knowing:
 *
 * 1. **Real tabs, not a row of buttons.** `role="tablist"` / `tab` / `tabpanel`
 *    with `aria-controls` and `aria-labelledby` in both directions, and arrow
 *    keys (plus Home/End) moving between tabs. A screen reader user is told how
 *    many views there are and which one they are on; a keyboard user never has
 *    to Tab through four labels to reach the panel.
 *
 * 2. **No autoplay, ever.** A slide that changes itself moves the figure a
 *    reader is looking at, and on a page of financial figures that is worse than
 *    a boring panel. There is also no swipe-only affordance: every view is
 *    reachable by keyboard and by click, so nothing is discoverable only by
 *    dragging.
 *
 * 3. **Everything stays mounted, the inactive slides are `hidden`.** Only the
 *    active one is laid out, so a hidden chart costs nothing to draw; but a
 *    slide holding form state (the outlay pivot's inline edit) does not lose it
 *    by being switched away from. `.panel-body` deliberately sets no `display`,
 *    because any `display` rule would beat the `hidden` attribute and leave the
 *    hidden slides stacked on top of each other.
 *
 * 4. **The switch is the app's one switch, and it is not dots.** The strip is
 *    `.tab-track` with the shared gold pill sliding under the active label,
 *    exactly like `SectionTabs` and every `SegmentedControl` — see
 *    docs/DESIGN.md §7. Labels rather than dots because a dot says "there are
 *    more of these" while the label says what they are, which is the whole
 *    question a reader has when the panel shows them a ring or a chart they did
 *    not expect.
 */
export default function SlideDeck({
  ariaLabel,
  slides,
  className = "",
}: {
  ariaLabel: string;
  slides: Slide[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  // Stable per-instance ids, so two decks on one page cannot label each other's
  // panels. `useId` renders identically on the server and the client.
  const id = useId();
  const active = Math.min(index, slides.length - 1);
  const current = slides[active];
  const { containerRef, itemRef, pill } = useSlidingPill<HTMLDivElement>(active);
  if (!current) return null;

  /** Arrow keys walk the strip and select as they go — the standard tab
   *  behaviour, because a tab is a view switch and not a form field. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (active + 1) % slides.length;
    else if (event.key === "ArrowLeft") next = (active - 1 + slides.length) % slides.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = slides.length - 1;
    if (next === null) return;

    event.preventDefault();
    setIndex(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <section className={`panel panel-fit ${className}`.trim()}>
      <div className="panel-head">
        <div
          ref={containerRef}
          role="tablist"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="tab-track"
        >
          {pill && (
            <span
              aria-hidden
              className="tab-pill"
              style={{
                transform: `translate(${pill.x}px, ${pill.y}px)`,
                width: pill.w,
                height: pill.h,
              }}
            />
          )}
          {slides.map((slide, i) => (
            <button
              key={slide.label}
              id={`${id}-tab-${i}`}
              ref={itemRef(i)}
              role="tab"
              type="button"
              aria-selected={i === active}
              aria-controls={`${id}-panel-${i}`}
              // Roving tabindex: the strip is one stop in the page's tab order
              // and the arrows move within it, so a four-view panel does not
              // cost four presses to walk past.
              tabIndex={i === active ? 0 : -1}
              onClick={() => setIndex(i)}
              className={`tab-item text-xs ${
                i === active
                  ? pill
                    ? "text-ink-950"
                    : "bg-accent text-ink-950"
                  : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              {slide.label}
            </button>
          ))}
        </div>
        {(current.hint || current.actions) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {current.hint && <p className="text-xs text-ink-500">{current.hint}</p>}
            {current.actions}
          </div>
        )}
      </div>

      {slides.map((slide, i) => (
        <div
          key={slide.label}
          id={`${id}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${i}`}
          // Focusable so a keyboard user can scroll a tall slide with the
          // arrows: a scrollable region with no focusable content inside it is
          // unreachable by keyboard otherwise.
          tabIndex={0}
          hidden={i !== active}
          className="panel-body focus:outline-none"
        >
          {/* Keyed on the label so the swap replays `.swap-in`, exactly like the
              range selectors: one motion for the whole change, applied to a
              container rather than to the chart inside it.

              `h-full` so a slide can divide the panel's height between its own
              blocks (the money deck's "By stakeholder" tab is a row of cards
              above a table that takes the rest) — a percentage height needs a
              definite parent, and without this the only definite height in the
              chain would sit above this div. A slide whose content is taller
              than the panel is unaffected: the div is not a scroll container, so
              the overflow still lands on `.panel-body`. */}
          <div key={slide.label} className="swap-in h-full">
            {slide.content}
          </div>
        </div>
      ))}
    </section>
  );
}
