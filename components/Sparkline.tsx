"use client";

import { toSparklinePoints, trendOf } from "@/lib/sparklines";

/** Semantic gain/loss tones, not palette colours: a sparkline's meaning here
 * is purely "up or down over the window", the same as the P/L figures it sits
 * beside. */
const UP = "#7fa87a"; // matches `gain`
const DOWN = "#c07f74"; // matches `loss`
const FLAT = "#8f8b85"; // matches `ink-500`

/**
 * A tiny trend line for one table row.
 *
 * Hand-rolled SVG rather than a chart component: this renders once per row
 * (~18 times per page), and mounting that many chart instances — each with
 * its own ResizeObserver and animation loop — costs far more than a single
 * polyline. There is deliberately no animation, so `prefers-reduced-motion`
 * needs no special handling.
 *
 * The trend is also exposed as `aria-label`, so the direction isn't conveyed
 * by colour and shape alone.
 */
export default function Sparkline({
  values,
  width = 64,
  height = 20,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const trend = trendOf(values);
  if (!trend) return null;

  const color = trend.direction === "up" ? UP : trend.direction === "down" ? DOWN : FLAT;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${values.length}-day trend ${trend.changePct >= 0 ? "+" : ""}${(
        trend.changePct * 100
      ).toFixed(1)}%`}
      className="inline-block align-middle"
    >
      <polyline
        points={toSparklinePoints(values, width, height)}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
