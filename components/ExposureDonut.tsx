"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";
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

/**
 * How far the hovered slice grows beyond the others, in pixels.
 *
 * Emphasis by GEOMETRY rather than by colour: the sector gets bigger and the
 * rest recede, so hovering compares rather than merely labels. Growing is safe
 * where recolouring is not — colour on this page means which bucket a holding
 * is in, and a hover must not be able to restate that.
 */
const POP = 6;

/** What everything that is NOT hovered drops to. Still legible at 0.35 (the
 *  fills are muted mid-tones on ink-900, so nothing disappears), which is the
 *  point: this is a comparison, and the rest of the ring has to stay readable
 *  as context rather than being switched off. */
const DIM = 0.35;

/**
 * One sector, drawn with the hover emphasis applied.
 *
 * Recharts' `shape` is called per sector with the computed geometry, so the
 * growth is a radius on ONE path rather than a transform on the ring — the
 * angles stay exactly where they are and the enlarged slice cannot overlap its
 * neighbour's label.
 *
 * `active` is the component's own state rather than Recharts' `isActive`, so
 * the ring, the hole's readout and the legend all read from one number; none of
 * them can disagree about which slice is the subject.
 */
function EmphasisSlice({ index, focus, ...rest }: PieSectorShapeProps & { focus: number | null }) {
  const isFocus = index === focus;
  return (
    <Sector
      {...rest}
      outerRadius={(rest.outerRadius ?? 0) + (isFocus ? POP : 0)}
      fillOpacity={focus === null || isFocus ? 1 : DIM}
      className="donut-slice"
    />
  );
}

interface DrawnSlice extends DonutSlice {
  fill: string;
  isUnclassified: boolean;
}

/**
 * How the holdings split by some tag — a donut plus a labelled legend.
 *
 * The legend carries the numbers, not just the colours: a donut is a shape you
 * have to estimate off, so each slice's exact value and share is printed
 * beside it. The chart is the overview; the list is the reading.
 *
 * There is NO tooltip. There was one — a boxed panel of label/value/share/
 * positions that tracked the pointer — and it was removed for being in the way:
 * it covered the hole and the neighbouring sectors, it sat between the pointer
 * and the thing being pointed at, and it was doing a job the legend already
 * does in full. What replaced it is the ring's own centre: the hovered slice's
 * name, value and share take the place of the total while the pointer is on it,
 * so the readout happens inside the shape you are circling rather than over it.
 * The one thing the box carried that the hole cannot fit is the per-slice
 * holding COUNT; that left the UI with it.
 *
 * The unclassified slice is drawn and listed LAST, after the named buckets, so
 * the remainder is visibly separate from the real categories.
 *
 * Sizing is deliberate, and was wrong before: at 160px with a 62% inner radius
 * the hole is ~99px across, and the figure `S$62,258.57` renders 92px wide —
 * 93% of the hole, which is why it looked like it was sitting on the ring. The
 * box is 176px now and the ring is drawn at 90% of it: the hole is 116px across,
 * which the figure clears comfortably, and there are 6px of slack left for the
 * hovered slice to grow into — an `outerRadius` of 100% would have the emphasis
 * clipped flat by the edge of the SVG, which is the subtle reason this number is
 * not 100. It was 192px for one pass, to give the hover more room; 176 is what
 * two of these cards need to share the chart column of a one-screen page.
 *
 * `folded` is whatever did not fit the palette (see capBreakdown), listed
 * behind a disclosure so the panel stays compact without the numbers
 * disappearing.
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
  // WHICH slice is hovered, not just whether one is — the centre readout, the
  // ring's emphasis and the legend all read from this one number, so they cannot
  // disagree about which bucket is the subject.
  const [active, setActive] = useState<number | null>(null);

  const drawn: DrawnSlice[] = [
    ...slices.map((s, i) => ({ ...s, fill: seriesColor(i), isUnclassified: false })),
    ...(unclassified
      ? [{ ...unclassified, fill: UNCLASSIFIED_FILL, isUnclassified: true }]
      : []),
  ];

  // What the hole is showing: the total, or the slice under the pointer.
  const focused = active === null ? null : drawn[active];

  if (drawn.length === 0) {
    return <p className="text-sm text-ink-300">No holdings to break down yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Ring and legend side by side, at every width the card is wide enough for
          it — a shorter card is what lets two of these sit in the chart column of
          a one-screen page, and the legend's ~260px is the price. They were
          stacked for one pass, to stop longer sector names truncating; that made
          each card ~430px tall, which two of them cannot fit under the section
          tabs on a laptop, so the cards went back to their compact shape. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* The leave is handled by the BOX rather than by each sector: moving
            from one slice to the next fires a leave and then an enter, which at
            best re-renders twice and at worst flickers between two states.
            Entering a sector only ever sets a new index; leaving the box is the
            one event that clears it. */}
        <div
          /* 176px, not 192: the two chart cards share a bounded column on a
             one-screen page, and 16px off each ring is what lets the pair fit
             a laptop without either card scrolling. The hole is 116px across at
             this size — the figure that used to sit on the ring measures 78px —
             and the hover's 6px of growth still lands inside the box. */
          className="relative h-44 w-44 shrink-0 self-center sm:self-auto"
          onMouseLeave={() => setActive(null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="valueSgd"
                nameKey="label"
                innerRadius="66%"
                outerRadius="90%"
                paddingAngle={1}
                stroke="#121212"
                strokeWidth={1}
                isAnimationActive={false}
                onMouseEnter={(_data: unknown, index: number) => setActive(index)}
                shape={(shapeProps: PieSectorShapeProps) => (
                  <EmphasisSlice {...shapeProps} focus={active} />
                )}
              >
                {drawn.map((slice) => (
                  <Cell key={slice.label} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* The hole: the total at rest, the hovered slice while the pointer is
              on the ring. Three lines in ~127px of hole, so the name is allowed
              to wrap to two and the figures stay on one — and `px-3` is what
              keeps a long name off the inner edge of the ring rather than
              letting it run underneath it. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-3 text-center">
            {focused ? (
              <>
                <span className="text-[10px] uppercase leading-tight tracking-wide text-ink-300">
                  {focused.label}
                </span>
                <span className="num text-xs text-ink-100">S${formatAmount(focused.valueSgd)}</span>
                <span className="num text-[10px] text-ink-500">
                  {(focused.weight * 100).toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wide text-ink-500">{centerLabel}</span>
                <span className="num text-xs text-ink-100">S${formatAmount(totalSgd)}</span>
              </>
            )}
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {drawn.map((slice, i) => (
            /* The legend dims with the ring: the same slice has to be the
               subject in both, or the emphasis says two different things. */
            <li
              key={slice.label}
              className={`flex items-center gap-2.5 text-xs transition-opacity motion-reduce:transition-none ${
                active === null || active === i ? "" : "opacity-40"
              }`}
            >
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
