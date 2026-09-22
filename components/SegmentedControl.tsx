"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * The pill is one absolutely positioned element behind the buttons, moved with
 * a transform, so the browser animates compositor-only properties and the
 * motion reads as the selection travelling rather than two separate repaints.
 * It is measured rather than assumed: the labels differ in width ("All" vs
 * "Completed Trades"), and the stakeholder row wraps onto a second line on
 * narrow screens, so the offset includes a vertical component too.
 *
 * `prefers-reduced-motion` drops the travel to zero duration via
 * `motion-reduce:transition-none` — the pill still lands in the right place.
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const index = options.findIndex((o) => o.value === value);
    const button = buttonsRef.current[index];
    if (!container || !button) return;

    const c = container.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    const next = {
      // clientLeft/clientTop are the container's borders: the pill is
      // positioned from the padding box, and ignoring the 1px border leaves it
      // a pixel out.
      x: b.left - c.left - container.clientLeft,
      y: b.top - c.top - container.clientTop,
      w: b.width,
      h: b.height,
    };
    // Bail out when nothing moved. Callers build `options` inline, so this
    // effect re-runs on every render — and storing an identical object would
    // re-render again, in a loop.
    setPill((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next
    );
  }, [options, value]);

  // After paint rather than during it: useLayoutEffect would run on the server
  // too and warn, and the active button carries its own highlight until the
  // first measurement lands (see `pill ? ... : ...` below), so there is no
  // frame without a visible selection.
  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    // Re-measure when the row reflows — a resize is what turns the stakeholder
    // row from one line into two, which moves every button after the first.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative flex rounded-md border border-ink-700 p-0.5 text-xs ${className}`.trim()}
    >
      {pill && (
        <span
          aria-hidden
          className="absolute left-0 top-0 rounded bg-accent transition-all duration-200 ease-out motion-reduce:transition-none"
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
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            // Until the pill has been measured the active button paints its own
            // background, so the selection is never invisible. Afterwards the
            // pill owns the colour: leaving both on would show two gold
            // rectangles mid-slide.
            className={`relative rounded px-2.5 py-1 transition-colors duration-200 motion-reduce:transition-none ${
              active
                ? pill
                  ? "text-ink-950"
                  : "bg-accent text-ink-950"
                : "text-ink-300 hover:text-ink-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
