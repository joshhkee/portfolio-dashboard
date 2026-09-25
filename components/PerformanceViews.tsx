"use client";

import { useState } from "react";
import SlideDeck, { type Slide } from "@/components/SlideDeck";
import SegmentedControl from "@/components/SegmentedControl";
import PortfolioValueChart from "@/components/PortfolioValueChart";
import DrawdownChart from "@/components/DrawdownChart";
import BenchmarkChart from "@/components/BenchmarkChart";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import RiskPanel, { type RiskPanelProps } from "@/components/RiskPanel";
import YearlyReturnsTable from "@/components/YearlyReturnsTable";
import { RANGE_KEYS, filterByRange, type PerfPoint, type RangeKey, type YearReturn } from "@/lib/performance";

/**
 * Returns and risk, as six single-subject slides.
 *
 * This was three slides holding seven panels between them — a value chart and a
 * drawdown curve and an index comparison stacked in one, a concentration panel
 * beside a risk-adjusted panel above a correlation matrix in the next — and the
 * consequence was exactly what the owner reported: the draws you came for were
 * below the fold of a sub-tab, so reading them meant scrolling INSIDE a panel
 * that is supposed to be one screen (docs/DESIGN.md §4). A slide whose content
 * is taller than its box is a slide doing too much.
 *
 * So the split is by SUBJECT, one per slide, and the test for a new panel is
 * whether it answers the same question as the panel beside it:
 *
 *   Value            what it is worth, against what you put in
 *   Drawdown         how far below its previous high it has sat
 *   vs index         the same window, measured against an index
 *   Risk             how much sits in how few names, and what the swings bought
 *   Correlation      whether those names move together
 *   Calendar years   the year-by-year record
 *
 * Three of those are the same chart with a different window, which is why the
 * range selector lives in the deck's HEAD (via `actions`) rather than at the top
 * of each chart: it is one control driving the window those three share, it is
 * not asked for on the other three, and the answer must not reset when you step
 * from the value line to the drawdown of the same days.
 *
 * The range state is here, above the deck, for that reason — the charts are
 * separate slides, so nothing below can hold it.
 */
export default function PerformanceViews({
  data,
  benchmarks,
  benchmarkSeries,
  risk,
  years,
}: {
  /** The full snapshot series; the window is applied here, client-side. */
  data: PerfPoint[];
  /** Indices available to compare against, already fetched server-side. */
  benchmarks: { key: string; label: string }[];
  /** Benchmark closes aligned 1:1 with `data` (see alignCloses), so the window
   *  slice below lines up with the portfolio series index for index. */
  benchmarkSeries: Record<string, (number | null)[]>;
  /** Every prop RiskPanel needs, precomputed on the server, or null when there
   *  is not enough history to be worth showing. */
  risk: RiskPanelProps | null;
  years: YearReturn[];
}) {
  const [range, setRange] = useState<RangeKey>("ALL");
  const filtered = filterByRange(data, range);

  // filterByRange always returns a suffix, so the offset that was dropped is
  // just the length difference — the benchmark arrays must be cut by exactly
  // the same amount or the regression would pair returns from different dates.
  const dropped = data.length - filtered.length;
  const filteredBenchmarks: Record<string, (number | null)[]> = {};
  for (const [key, values] of Object.entries(benchmarkSeries)) {
    filteredBenchmarks[key] = values.slice(dropped, dropped + filtered.length);
  }

  const rangeControl = (
    <SegmentedControl
      ariaLabel="Chart time range"
      options={RANGE_KEYS.map((key) => ({ value: key, label: key === "ALL" ? "All" : key }))}
      value={range}
      onChange={setRange}
    />
  );

  const slides: Slide[] = [
    {
      label: "Value",
      hint: "What it is worth, and what you put in",
      actions: rangeControl,
      content: (
        <div className="flex h-full min-h-0 flex-col p-4">
          <PortfolioValueChart data={filtered} fill />
        </div>
      ),
    },
    {
      label: "Drawdown",
      hint: "How far below its previous high it has sat",
      actions: rangeControl,
      content: (
        <div className="flex h-full min-h-0 flex-col p-4">
          <DrawdownChart data={filtered} fill />
        </div>
      ),
    },
    // Only when an index has history: a tab that would say "no benchmark data"
    // is a tab that should not be there.
    ...(benchmarks.length > 0
      ? [
          {
            label: "vs index",
            hint: "Both lines rebased to 100 at the window's start",
            actions: rangeControl,
            content: (
              <div className="flex h-full min-h-0 flex-col p-4">
                <BenchmarkChart
                  points={filtered}
                  benchmarks={benchmarks}
                  series={filteredBenchmarks}
                />
              </div>
            ),
          } satisfies Slide,
        ]
      : []),
    ...(risk
      ? [
          {
            label: "Risk",
            hint: "How much sits in how few names, and what the swings bought",
            content: (
              <div className="flex h-full min-h-0 flex-col p-4">
                <RiskPanel {...risk} />
              </div>
            ),
          } satisfies Slide,
        ]
      : []),
    {
      label: "Correlation",
      hint: "6 months of daily returns · pair by pair",
      content: (
        // Fills the panel: the grid of pairs is sized by the number of
        // holdings, so it — not the slide — is what scrolls when there are
        // more names than rows of space.
        <div className="flex h-full min-h-0 flex-col p-4">
          <CorrelationHeatmap />
        </div>
      ),
    },
    {
      label: "Calendar years",
      hint: "One row per year, newest first",
      content: (
        // Fills too, so the table takes the slide's height and scrolls its own
        // rows if the history ever grows past a handful of years.
        <div className="flex h-full min-h-0 flex-col p-4">
          <YearlyReturnsTable years={years} />
        </div>
      ),
    },
  ];

  return <SlideDeck ariaLabel="Performance view" slides={slides} />;
}
