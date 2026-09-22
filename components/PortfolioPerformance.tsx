"use client";

import { useState } from "react";
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
}: {
  data: PerfPoint[];
  /** Indices available to compare against, already fetched server-side. */
  benchmarks?: { key: string; label: string }[];
  /** Benchmark closes aligned 1:1 with `data` (see alignCloses), so the
   * window slice below lines up with the portfolio series index for index. */
  benchmarkSeries?: Record<string, (number | null)[]>;
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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div
          role="group"
          aria-label="Chart time range"
          className="flex rounded-md border border-ink-700 p-0.5 text-xs"
        >
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={`rounded px-2.5 py-1 transition ${
                range === key ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
      </div>

      <PortfolioValueChart data={filtered} />
      <DrawdownChart data={filtered} />
      {benchmarks.length > 0 && (
        <BenchmarkChart
          points={filtered}
          benchmarks={benchmarks}
          series={filteredBenchmarks}
        />
      )}
    </div>
  );
}
