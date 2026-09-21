"use client";

import { useState } from "react";
import PortfolioValueChart from "@/components/PortfolioValueChart";
import DrawdownChart from "@/components/DrawdownChart";
import { filterByRange, RANGE_KEYS, type PerfPoint, type RangeKey } from "@/lib/performance";

/**
 * Owns the time-range selection and drives both performance charts from it, so
 * the value line and the drawdown curve can never disagree about which window
 * they're showing.
 *
 * Filtering happens client-side over the full snapshot series, which is why no
 * chart is server-rendered per range — the series is already small (hundreds of
 * daily points) and shipping it once beats a round trip per button press.
 */
export default function PortfolioPerformance({ data }: { data: PerfPoint[] }) {
  const [range, setRange] = useState<RangeKey>("ALL");
  const filtered = filterByRange(data, range);

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
    </div>
  );
}
