"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/palette";
import { formatAmount } from "@/components/SignedNumber";

export interface DonutSlice {
  label: string;
  /** Value in SGD. */
  valueSgd: number;
  /** Share of total holdings value, 0..1. */
  weight: number;
  positions: number;
}

/**
 * Muted warm grey for the "nobody has tagged this yet" slice.
 *
 * Deliberately the ONLY desaturated fill in the chart: every real bucket draws
 * from the six-colour data palette, so the grey reads as "the remainder"
 * rather than as just another exposure category. It is also named in the
 * legend and explained in the caption, so the distinction never depends on
 * noticing a colour.
 */
const UNCLASSIFIED_FILL = "#8f8b85";

interface DrawnSlice extends DonutSlice {
  fill: string;
  isUnclassified: boolean;
}

interface TooltipItem {
  payload: DrawnSlice;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0].payload;

  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-100">{slice.label}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Value</span>
        <span className="num text-ink-100">S${formatAmount(slice.valueSgd)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Share</span>
        <span className="num text-ink-100">{(slice.weight * 100).toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Position{slice.positions === 1 ? "" : "s"}</span>
        <span className="num text-ink-100">{slice.positions}</span>
      </div>
    </div>
  );
}

/**
 * How the holdings split by some tag — a donut plus a labelled legend.
 *
 * The legend carries the numbers, not just the colours: a donut is a shape you
 * have to estimate off, so each slice's exact value and share is printed
 * beside it. The chart is the overview; the list is the reading.
 *
 * The unclassified slice is drawn and listed LAST, after the named buckets, so
 * the remainder is visibly separate from the real categories.
 */
export default function ExposureDonut({
  slices,
  unclassified,
  totalSgd,
  unclassifiedNote,
}: {
  slices: DonutSlice[];
  unclassified: DonutSlice | null;
  totalSgd: number;
  /** One line explaining the grey slice, e.g. what tagging it would fix. */
  unclassifiedNote?: string;
}) {
  const drawn: DrawnSlice[] = [
    ...slices.map((s, i) => ({ ...s, fill: seriesColor(i), isUnclassified: false })),
    ...(unclassified
      ? [{ ...unclassified, fill: UNCLASSIFIED_FILL, isUnclassified: true }]
      : []),
  ];

  if (drawn.length === 0) {
    return <p className="text-sm text-ink-300">No holdings to break down yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-40 w-40 shrink-0 self-center sm:self-auto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="valueSgd"
                nameKey="label"
                innerRadius="62%"
                outerRadius="100%"
                paddingAngle={1}
                stroke="#121212"
                strokeWidth={1}
                isAnimationActive={false}
              >
                {drawn.map((slice) => (
                  <Cell key={slice.label} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label: the total, so the ring never floats unanchored. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-ink-500">Total</span>
            <span className="num text-sm text-ink-100">S${formatAmount(totalSgd)}</span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {drawn.map((slice) => (
            <li key={slice.label} className="flex items-center gap-2.5 text-xs">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.fill }}
              />
              <span
                className={`min-w-0 flex-1 truncate ${
                  slice.isUnclassified ? "text-ink-300" : "text-ink-100"
                }`}
                title={slice.label}
              >
                {slice.label}
              </span>
              <span className="num shrink-0 text-ink-300">S${formatAmount(slice.valueSgd)}</span>
              <span className="num w-11 shrink-0 text-right text-ink-500">
                {(slice.weight * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {unclassified && unclassifiedNote && (
        <p className="text-xs text-ink-500">{unclassifiedNote}</p>
      )}
    </div>
  );
}
