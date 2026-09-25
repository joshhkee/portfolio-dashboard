"use client";

import { useState } from "react";
import ExposureDonut from "@/components/ExposureDonut";
import SegmentedControl from "@/components/SegmentedControl";
import type { ExposureBucket, UnclassifiedSlice } from "@/lib/exposure";

export interface ExposureView {
  /** The cut's own name — "Sector", "Type", "Currency". */
  label: string;
  /** Right-hand caption for the view: the one derived line worth reading. */
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
 * The exposure breakdowns, as two rings you can read at once.
 *
 * This has been three shapes, and the order is instructive:
 *
 * 1. **Two stacked panels** (sector with type behind a hand-rolled toggle, then
 *    currency below it) — the same 176px ring drawn twice, ~700px of a 900px
 *    window, and whichever ring you were not reading still held its share.
 * 2. **One `SlideDeck`**, all three cuts sharing a single slot. That fixed the
 *    height and lost something real: a reader comparing what the portfolio is
 *    TAGGED with against what it is DENOMINATED in had to remember the first
 *    ring while looking at the second.
 * 3. **What it is now**: the two cuts that answer different questions are two
 *    panels, both visible; the one cut that is the same circle sliced a second
 *    way (sector and type are two groupings of the same holdings) stays behind a
 *    small toggle on the first panel, where switching costs one click and no
 *    memory. That is the rule this page settled on: stack what you compare,
 *    switch what you don't.
 *
 * The toggle is the app's one switch (`SegmentedControl` — gold pill, sliding
 * animation, see docs/DESIGN.md §7), so the same gesture reads the same way here
 * as it does in a chart's range picker. The deck is no longer used on this page
 * at all.
 */
export default function ExposureSummary({
  sector,
  type,
  currency,
}: {
  sector: ExposureView;
  type: ExposureView;
  currency: ExposureView;
}) {
  const [cut, setCut] = useState<"sector" | "type">("sector");
  const view = cut === "sector" ? sector : type;

  return (
    // `lg:grow` on both panels, not `lg:flex-1`: `flex-1` is `flex: 1 1 0%`, so it
    // would also let the panels SHRINK below their content on a short window and
    // clip a ring's legend inside its own card — the failure docs/DESIGN.md §4
    // records from the last time this column split its height between two
    // charts. `grow` only ever adds space (basis stays content), so a tall window
    // gets two taller panels instead of a dead strip at the bottom of the column,
    // and a short one still scrolls the column as one unit.
    // `lg:grow` here as well as on the panels: without it this wrapper is only as
    // tall as its content, the two panels have no free space to grow into, and
    // the column ends in a dead strip.
    // `lg:gap-1.5` between the two cards and `lg:gap-2 lg:p-3` inside them: at
    // 1024×600 the pair measured 29px taller than the column that holds them, so
    // the column scrolled — a card's last legend row cut off, which reads as a
    // broken panel rather than as a short window. Every pixel of that 29 comes
    // out of spacing rather than content: the ring stays 176px (a 160px box puts
    // the figure back on the ring itself — see ExposureDonut) and both captions
    // stay. The column keeps its `overflow-y-auto` for a window shorter still.
    <div className="flex flex-col gap-3 lg:grow lg:gap-1.5">
      {/* Panel one: the same holdings grouped two ways. */}
      <section className="panel flex flex-col gap-3 p-4 lg:grow lg:gap-2 lg:p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <SegmentedControl
            ariaLabel="Group the holdings by"
            options={[
              { value: "sector", label: sector.label },
              { value: "type", label: type.label },
            ]}
            value={cut}
            onChange={setCut}
          />
          {/* The hint belongs to whichever cut is showing, so it is keyed to it:
              the caption changes with the ring rather than beside it. */}
          <p key={cut} className="swap-in text-xs text-ink-500">
            {view.hint}
          </p>
        </div>
        <div key={`${cut}-ring`} className="swap-in">
          <ExposureDonut
            slices={view.slices}
            unclassified={view.unclassified}
            totalSgd={view.totalSgd}
            centerLabel={view.centerLabel}
            folded={view.folded}
            unclassifiedNote={view.note}
          />
        </div>
      </section>

      {/* Panel two: what the value is denominated in. Always on screen, because
          the question it answers ("how much of this carries currency risk?") is
          about the portfolio as a whole rather than about one of its groupings,
          and a reader asks it while looking at the first ring. */}
      <section className="panel flex flex-col gap-3 p-4 lg:grow lg:gap-2 lg:p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-xs text-ink-300">{currency.label}</p>
          <p className="text-xs text-ink-500">{currency.hint}</p>
        </div>
        <ExposureDonut
          slices={currency.slices}
          unclassified={currency.unclassified}
          totalSgd={currency.totalSgd}
          centerLabel={currency.centerLabel}
          folded={currency.folded}
          unclassifiedNote={currency.note}
        />
      </section>
    </div>
  );
}
