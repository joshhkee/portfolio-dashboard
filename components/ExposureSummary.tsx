"use client";

import { useState } from "react";
import ExposureDonut from "@/components/ExposureDonut";
import type { ExposureBucket, UnclassifiedSlice } from "@/lib/exposure";

export interface ExposureView {
  /** Tab label, e.g. "By sector". */
  label: string;
  /** Right-hand caption for the selected view. */
  hint: string;
  /** What the donut draws: the named buckets, then "Other tags" if folded. */
  slices: ExposureBucket[];
  unclassified: UnclassifiedSlice | null;
  /** Named buckets folded into "Other tags", shown from the legend. */
  folded: ExposureBucket[];
  /** Total holdings value in SGD, for the ring's centre figure. */
  totalSgd: number;
  /** The label inside the ring under the total. */
  centerLabel?: string;
  /** One line under the chart. */
  note?: string;
}

/**
 * One panel, two ways of cutting the same holdings.
 *
 * The two breakdowns answer different questions — "what did I choose to buy"
 * (hand-tagged) versus "what am I holding the wrapper of" (reported by the
 * lookup) — and stacking them as two donuts side by side would spend half the
 * page repeating the same circle. So they share one panel and one toggle, the
 * way the range selectors share one chart.
 *
 * The switch is animated by remounting under a new key, exactly like the
 * period selectors: one motion for the whole change, applied to a container
 * rather than to the ring itself, so the legend and the caption move with it.
 */
export default function ExposureSummary({ views }: { views: ExposureView[] }) {
  const [index, setIndex] = useState(0);
  const active = views[index] ?? views[0];
  if (!active) return null;

  return (
    <section className="panel flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-1">
          {views.map((view, i) => (
            <button
              key={view.label}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              className={`rounded-md px-2.5 py-1 text-sm transition motion-reduce:transition-none ${
                i === index
                  ? "bg-ink-800 text-ink-100"
                  : "text-ink-500 hover:text-ink-100"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">{active.hint}</p>
      </div>

      {/* Keyed on the view so the container replays .swap-in on every switch.
          Deliberately not keyed on the data: the panel should keep its shape
          while the numbers change under it. */}
      <div key={active.label} className="swap-in flex flex-col gap-3">
        <ExposureDonut
          slices={active.slices}
          unclassified={active.unclassified}
          totalSgd={active.totalSgd}
          centerLabel={active.centerLabel}
          folded={active.folded}
          unclassifiedNote={active.note}
        />
      </div>
    </section>
  );
}
