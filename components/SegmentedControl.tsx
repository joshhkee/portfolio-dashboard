"use client";

import { useSlidingPill } from "@/lib/use-sliding-pill";

export interface SegmentedOption<T extends string | null> {
  value: T;
  label: string;
}

/**
 * A row of mutually exclusive buttons with a gold pill that SLIDES to the
 * selected one.
 *
 * Four controls in the app ask the same kind of question — which time range,
 * which benchmark index, which stakeholder, which period grouping — and they
 * were four copies of the same markup whose only feedback was the highlight
 * changing colour between two adjacent buttons. There was no visual thread
 * tying the button you pressed to the button that lit up.
 *
 * The pill is `.panel`-independent markup from one place now: this is the
 * original of the app's one switch, and `SectionTabs` and `SlideDeck` share its
 * look and its measurement (`useSlidingPill` + `.tab-track`/`.tab-pill`/
 * `.tab-item` — see the note in globals.css and docs/DESIGN.md §7). It was the
 * OTHER two that drifted, not this one; the point of the extraction is that
 * there is nothing left to drift.
 *
 * `prefers-reduced-motion` drops the travel to zero duration via `.tab-pill` —
 * the pill still lands in the right place.
 */
export default function SegmentedControl<T extends string | null>({
  ariaLabel,
  options,
  value,
  onChange,
  className = "",
}: {
  ariaLabel: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const { containerRef, itemRef, pill } = useSlidingPill<HTMLDivElement>(activeIndex);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`tab-track text-xs ${className}`.trim()}
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
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={itemRef(i)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            // Until the pill has been measured the active button paints its own
            // background, so the selection is never invisible. Afterwards the
            // pill owns the colour: leaving both on would show two gold
            // rectangles mid-slide.
            className={`tab-item ${active ? (pill ? "text-ink-950" : "bg-accent text-ink-950") : "text-ink-300 hover:text-ink-100"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
