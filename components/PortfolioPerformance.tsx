"use client";

import { useState } from "react";
import SegmentedControl from "@/components/SegmentedControl";
import PortfolioValueChart from "@/components/PortfolioValueChart";
import DrawdownChart from "@/components/DrawdownChart";
import BenchmarkChart from "@/components/BenchmarkChart";
import { filterByRange, RANGE_KEYS, type PerfPoint, type RangeKey } from "@/lib/performance";

/**
 * Owns the time-range selection and drives every performance chart from it, so
 * the value line, the drawdown curve and the benchmark comparison can never
 * disagree about which window they're showing.
 *
 * Filtering happens client-side over the full snapshot series, which is why no
 * chart is server-rendered per range — the series is already small (hundreds of
 * daily points) and shipping it once beats a round trip per button press.
 */
export default function PortfolioPerformance({
  data,
  benchmarks = [],
  benchmarkSeries = {},
  charts = "all",
  fill = false,
}: {
  data: PerfPoint[];
  /** Indices available to compare against, already fetched server-side. */
  benchmarks?: { key: string; label: string }[];
  /** Benchmark closes aligned 1:1 with `data` (see alignCloses), so the
   * window slice below lines up with the portfolio series index for index. */
  benchmarkSeries?: Record<string, (number | null)[]>;
  /**
   * Which charts this instance owns.
   *
   * `"value"` renders the portfolio line alone, for the dashboard, where the
   * job is "what is it worth and which way is it going" and one chart is the
   * whole budget. `"all"` is the performance page's version, where the drawdown
   * and the index comparison are the subject rather than a footnote. Same
   * component, same range state, same data — so the two pages cannot disagree
   * about what a window means.
   */
  charts?: "all" | "value";
  /**
   * Take the height the parent has left instead of each chart's own fixed one.
   *
   * Set by the dashboard, where the chart shares a row with the largest
   * positions and the whole page is meant to be read without scrolling: there
   * the chart is the block that can afford to grow and shrink, so a tall window
   * gets a taller chart. Left off on the performance page, where three charts
   * stack and a fixed, predictable height each is what makes them comparable.
   */
  fill?: boolean;
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

  return (
    <div className={`flex flex-col gap-4${fill ? " min-h-0 flex-1" : ""}`}>
      <div className="flex justify-end">
        <SegmentedControl
          ariaLabel="Chart time range"
          options={RANGE_KEYS.map((key) => ({ value: key, label: key === "ALL" ? "All" : key }))}
          value={range}
          onChange={setRange}
        />
      </div>

      {/* Deliberately NOT keyed on the range. Remounting these on every switch
          restarts each chart from an empty axis, so the line redraws itself
          from scratch — what you want is the same chart narrowing its window,
          which is what Recharts does when the data changes under a mounted
          chart. (An earlier pass wrapped this in a crossfade as well, which
          only gave the eye two things to watch.) */}
      <div className={`flex flex-col gap-4${fill ? " min-h-0 flex-1" : ""}`}>
        <PortfolioValueChart data={filtered} fill={fill} />
        {charts === "all" && (
          <>
            <DrawdownChart data={filtered} />
            {benchmarks.length > 0 && (
              <BenchmarkChart
                points={filtered}
                benchmarks={benchmarks}
                series={filteredBenchmarks}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
