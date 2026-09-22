"use client";

/**
 * Where the latest price sits between the window's low and high.
 *
 * A track with a filled portion and a marker, rather than a number: "0.24 of
 * the 1-year range" is a fact nobody can feel, while a dot a quarter of the way
 * along a bar is immediately legible. The fill is the brand gold — the same
 * colour the portfolio's own series uses — deliberately NOT green or red: the
 * position in a range is not a gain or a loss, and the colour rule says colour
 * means up or down.
 *
 * `role="img"` with a label, so the position is not conveyed by the picture
 * alone.
 */
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
      className="relative inline-block align-middle"
      style={{ width, height: 4 }}
    >
      <span className="absolute inset-0 rounded-full bg-ink-700" />
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
      {/* The marker sits on top of the fill, so the current value is readable
          even at 0% and 100% where the fill alone would be invisible. */}
      <span
        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-ink-100"
        style={{ left: `calc(${pct}% - 4px)` }}
      />
    </span>
  );
}
