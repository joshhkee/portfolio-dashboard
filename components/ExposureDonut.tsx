"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/palette";
import { formatAmount } from "@/components/SignedNumber";

export interface DonutSlice {
  label: string;
  /** Value in SGD. */
  valueSgd: number;
  /** Share of total holdings value, 0..1 */
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
      <p className="mb-1.5 text-xs text-ink-300">{slice.label}</p>
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
 *
 * Sizing is deliberate, and was wrong before: at 160px with a 62% inner radius
 * the hole is ~99px across, and the figure `S$62,258.57` renders 92px wide —
 * 93% of the hole, which is why it looked like it was sitting on the ring. The
 * ring is 176px now and the figure is 12px, which puts it at about two thirds
 * of the hole. `folded` is whatever did not fit the palette (see
 * capBreakdown), listed behind a disclosure so the panel stays compact without
 * the numbers disappearing.
 */
export default function ExposureDonut({
  slices,
  unclassified,
  totalSgd,
  unclassifiedNote,
  folded = [],
  centerLabel = "Total",
}: {
  slices: DonutSlice[];
  unclassified: DonutSlice | null;
  totalSgd: number;
  /** One line explaining the grey slice, e.g. what tagging it would fix. */
  unclassifiedNote?: string;
  /** Named buckets folded into the last slice, shown on demand. */
  folded?: DonutSlice[];
  /** "Total" by default; the type view says "Holdings". */
  centerLabel?: string;
}) {
  // Tracked so the centre figure can step out of the tooltip's way: at this
  // size a tooltip covers the hole, and a total half-hidden behind a panel was
  // the other half of the illegibility complaint.
  const [hovered, setHovered] = useState(false);

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
        <div className="relative h-44 w-44 shrink-0 self-center sm:self-auto">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="valueSgd"
                nameKey="label"
                innerRadius="66%"
                outerRadius="100%"
                paddingAngle={1}
                stroke="#121212"
                strokeWidth={1}
                isAnimationActive={false}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                {drawn.map((slice) => (
                  <Cell key={slice.label} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label: the total, so the ring never floats unanchored —
              and it yields to the tooltip rather than fighting it for the same
              pixels. */}
          <div
            className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity motion-reduce:transition-none ${
              hovered ? "opacity-0" : "opacity-100"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wide text-ink-500">{centerLabel}</span>
            <span className="num text-xs text-ink-100">S${formatAmount(totalSgd)}</span>
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

          {folded.length > 0 && (
            <li>
              <details className="group mt-0.5">
                <summary className="cursor-pointer list-none text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none">
                  <span className="group-open:hidden">
                    Show the {folded.length} tag{folded.length === 1 ? "" : "s"} inside “Other tags” →
                  </span>
                  <span className="hidden group-open:inline">Hide the folded tags</span>
                </summary>
                <ul className="mt-1.5 flex flex-col gap-1.5 border-l border-ink-700 pl-3">
                  {folded.map((slice) => (
                    <li key={slice.label} className="flex items-center gap-2.5 text-xs">
                      <span className="min-w-0 flex-1 truncate text-ink-300" title={slice.label}>
                        {slice.label}
                      </span>
                      <span className="num shrink-0 text-ink-300">
                        S${formatAmount(slice.valueSgd)}
                      </span>
                      <span className="num w-11 shrink-0 text-right text-ink-500">
                        {(slice.weight * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
      </div>

      {unclassified && unclassifiedNote && (
        <p className="text-xs text-ink-500">{unclassifiedNote}</p>
      )}
    </div>
  );
}
