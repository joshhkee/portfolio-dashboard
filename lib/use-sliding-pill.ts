"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Where the pill sits, relative to its track's padding box, and how big it is
 *  — measured, never assumed. The vertical component matters: these tracks wrap
 *  onto a second line on narrow screens, which is a y offset and not just x. */
export interface PillRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The gold pill that slides to the selected item in a track.
 *
 * This is the ONE implementation behind every "pick one of N" control in the
 * app — `SegmentedControl` (ranges, benchmarks, stakeholders, period grouping),
 * `SectionTabs` (the section strip) and `SlideDeck` (a panel's views). It exists
 * because they were hand-rolled separately and drifted: the segmented controls
 * slid a gold pill while the section strip and the slide decks just repainted
 * the active item with `accentMuted`, so the same gesture looked like two
 * different controls on two pages. The track's LOOK is `.tab-track` /
 * `.tab-pill` / `.tab-item` in globals.css; this owns the measurement and the
 * transform (docs/DESIGN.md §7).
 *
 * The pill is one absolutely positioned element moved with `transform`, so the
 * browser animates compositor-only properties: the selection reads as
 * travelling rather than as two separate repaints. It is positioned from the
 * track's PADDING box (`clientLeft`/`clientTop` are the 1px border), because a
 * pixel of drift is visible on a 30px control.
 *
 * Three implementation notes worth keeping:
 *
 * 1. **It bails out when nothing moved.** Callers build their arrays inline, so
 *    the effect re-runs on every render; storing an identical rectangle would
 *    re-render again, in a loop.
 * 2. **A `ResizeObserver` re-measures on reflow.** That is what follows the pill
 *    when a track wraps to a second line, and when a resize changes every
 *    label's width.
 * 3. **`activeIndex < 0` clears it**, so a track with nothing selected draws no
 *    pill rather than leaving one stranded under whatever was selected before.
 *
 * The caller keeps the active item's own background until the first measurement
 * lands (`pill ? … : "bg-accent"`), so there is never a frame without a visible
 * selection. `prefers-reduced-motion` drops the travel to zero duration via
 * `.tab-pill`'s `motion-reduce:transition-none` — the pill still lands right.
 */
export function useSlidingPill<T extends HTMLElement>(activeIndex: number) {
  const containerRef = useRef<T | null>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const [pill, setPill] = useState<PillRect | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const item = itemsRef.current[activeIndex];
    if (!container || !item) {
      setPill(null);
      return;
    }

    const c = container.getBoundingClientRect();
    const b = item.getBoundingClientRect();
    const next: PillRect = {
      x: b.left - c.left - container.clientLeft,
      y: b.top - c.top - container.clientTop,
      w: b.width,
      h: b.height,
    };
    setPill((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next
    );
  }, [activeIndex]);

  // After paint rather than during it: `useLayoutEffect` would run on the server
  // too and warn, and the caller's fallback covers the first frame.
  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  /** Ref callback for item `index`. Stable, so React never detaches and
   *  re-attaches every item on each render. */
  const itemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemsRef.current[index] = el;
    },
    []
  );

  return { containerRef, itemRef, pill };
}
