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
 * Returns and risk, as six slides.
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
 *   Value & drawdown  what it is worth, and the dips from each high — the same
 *                     window drawn twice, stacked so the two lines can be read
 *                     against each other instead of one tab apart
 *   vs index          the same window, measured against an index
 *   Concentration     how much sits in how few names
 *   Risk-adjusted     what the swings bought (volatility, Sharpe, the trailing year)
 *   Correlation       whether those names move together
 *   Calendar years    the year-by-year record
 *
 * Value and drawdown are the deliberate exception to one-subject-per-slide:
 * they are not two subjects, they are one window seen two ways, and separating
 * them cost the comparison the range selector exists to enable — you could ask
 * for the last year and then have to hold the shape of one curve in your head
 * while the other drew. Stacked, the second is read against the first. The two
 * RISK halves stay split, because the pair needed 63px more than a 1024×600
 * panel-body had (`RiskPanel.panel`) — the same failure, but there the two
 * panels genuinely answer different questions.
 *
 * Three slides are the same chart with a different window, which is why the
 * range selector lives in the deck's HEAD (via `actions`) rather than at the top
 * of each chart: it is one control driving the window those three share, it is
 * not asked for on the others, and the answer must not reset when you step from
 * the value line to the index comparison of the same days.
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
   *  is not enough history to be worth showing. `panel` is the exception: which
   *  half to draw is this deck's decision, not the data's, so the server hands
   *  over the figures and the deck puts each half on its own slide. */
  risk: Omit<RiskPanelProps, "panel"> | null;
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
      label: "Value & drawdown",
      hint: "What it is worth, above how far below its peak it has sat",
      actions: rangeControl,
      content: (
        // One slide, two plots, stacked. They are the SAME window drawn twice —
        // the level and the fall from each high — so the question they answer
        // together ("am I below where I was, and how much of the gain did that
        // give back") is a glance rather than a tab switch. `fill` on both is
        // what splits the slide's height between them; the divider says where
        // one plot ends and the next begins without spending a panel on it.
        // Below `lg` the shell hands out no heights, so each chart falls back
        // to its own fixed height (224px / 140px) and stacks in the flow.
        <div className="flex h-full min-h-0 flex-col gap-4 p-4">
          <PortfolioValueChart data={filtered} fill />
          <div className="flex min-h-0 flex-1 flex-col border-t border-ink-700/60 pt-4">
            <DrawdownChart data={filtered} fill />
          </div>
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
                  fill
                />
              </div>
            ),
          } satisfies Slide,
        ]
      : []),
    // Two slides rather than one with two cards: side by side they answer
    // different questions, and together they need 63px more than a 1024×600
    // panel-body has — which is what put a scrollbar inside this sub-tab. On a
    // tall window each of these is now one panel taking the whole slide, so the
    // concentration list and the rolling chart both get MORE height than they
    // had in the shared card, not less.
    ...(risk
      ? [
          {
            label: "Concentration",
            hint: "How much sits in how few names",
            content: (
              <div className="flex h-full min-h-0 flex-col p-4">
                <RiskPanel {...risk} panel="concentration" />
              </div>
            ),
          } satisfies Slide,
          {
            label: "Risk-adjusted",
            hint: "What the swings bought",
            content: (
              <div className="flex h-full min-h-0 flex-col p-4">
                <RiskPanel {...risk} panel="return" />
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
