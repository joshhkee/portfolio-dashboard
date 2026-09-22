"use client";

/**
 * Where the latest price sits between the window's low and high.
 *
 * A track with a filled portion and a needle, rather than a number: "0.24 of
 * the 1-year range" is a fact nobody can feel, while a marker a quarter of the
 * way along a bar is immediately legible. The fill is the brand gold — the same
 * colour the portfolio's own series uses — deliberately NOT green or red: the
 * position in a range is not a gain or a loss, and the colour rule says colour
 * means up or down.
 *
 * The needle is a 2px vertical line, not a round knob, and that is the point:
 * a filled track with a circular handle on it is what a slider looks like, and
 * the first version was read as draggable. The end ticks say "this is a scale"
 * for the same reason — a control has handles, a gauge has graduations. Nothing
 * here is a button, has a hover state, or should be clicked.
 *
 * `role="img"` with a label, so the position is not conveyed by the picture
 * alone.
 */
export default function RangeBar({
  position,
  label,
  width = 64,
}: {
  /** 0 = at the low, 1 = at the high. */
  position: number;
  label: string;
  width?: number;
}) {
  const pct = Math.min(100, Math.max(0, position * 100));
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="relative inline-block cursor-default align-middle"
      style={{ width, height: 10 }}
    >
      {/* Graduations at both ends: a scale, not a control. */}
      <span className="absolute left-0 top-0 h-full w-px bg-ink-600" />
      <span className="absolute right-0 top-0 h-full w-px bg-ink-600" />
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink-700" />
      <span
        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
      <span
        className="absolute top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-ink-100"
        style={{ left: `${pct}%` }}
      />
    </span>
  );
}

/**
 * The position as words, to one decimal.
 *
 * One decimal rather than rounding: at 99.5% of the range a rounded "100%"
 * contradicts the "0.3% below its high" beside it, and a reader who notices
 * that stops trusting both numbers.
 */
export function rangePositionLabel(position: number): string {
  const pct = Math.min(100, Math.max(0, position * 100));
  return `${pct.toFixed(1)}% of the 1-year range`;
}
