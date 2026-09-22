"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { alphaBeta, benchmarkVerdict, growthIndex, rebaseTo100 } from "@/lib/benchmarks";
import {
  portfolioDailyReturns,
  priceReturns,
  type PerfPoint,
} from "@/lib/performance";
import BenchmarkExplainer from "@/components/BenchmarkExplainer";

/** Same order as the value chart's series so the two read consistently: the
 * portfolio keeps the gold it has everywhere else, the benchmark takes the
 * first muted data colour (steel) so the comparison never depends on hue
 * alone — the two also differ in stroke dash and weight. */
const PORTFOLIO_COLOR = "#d4a94a";
const BENCHMARK_COLOR = "#7d97b3";

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]}`;
}

function longDate(key: string): string {
  const [y, m, d] = key.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

interface TooltipItem {
  payload: {
    date: string;
    portfolio: number;
    benchmark: number | null;
  };
}

function BenchmarkTooltip({
  active,
  payload,
  benchmarkLabel,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  benchmarkLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const diff =
    point.benchmark === null ? null : point.portfolio - point.benchmark;

  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">{longDate(point.date)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="flex items-center gap-1.5 text-ink-300">
          <span className="inline-block h-0.5 w-3" style={{ background: PORTFOLIO_COLOR }} />
          Portfolio
        </span>
        <span className="num text-ink-100">{point.portfolio.toFixed(1)}</span>
      </div>
      {point.benchmark !== null && (
        <>
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-ink-300">
              <span className="inline-block h-0.5 w-3" style={{ background: BENCHMARK_COLOR }} />
              {benchmarkLabel}
            </span>
            <span className="num text-ink-100">{point.benchmark.toFixed(1)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-6 border-t border-ink-700 pt-1">
            <span className="text-ink-300">Difference</span>
            <span className={`num ${diff! >= 0 ? "text-gain" : "text-loss"}`}>
              {diff! >= 0 ? "+" : ""}
              {diff!.toFixed(1)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <p className="text-xs text-ink-300">{label}</p>
      <p className="num text-sm text-ink-100">{value}</p>
    </div>
  );
}

/**
 * Portfolio against one index, both rebased to 100 at the start of the
 * selected window, with the regression that describes the relationship.
 *
 * The portfolio line is a growth index, not portfolio value — see
 * growthIndex() for why comparing raw value to a price index would mostly
 * plot the owner's deposits.
 *
 * The benchmark selector is local state rather than a server round trip:
 * every benchmark's aligned series is already in the props, so switching is
 * instant and costs no network, which is also what keeps the page to a
 * bounded number of Yahoo calls (three, cached — see getBenchmarkCloses).
 */
export default function BenchmarkChart({
  points,
  benchmarks,
  series,
}: {
  points: PerfPoint[];
  benchmarks: { key: string; label: string }[];
  series: Record<string, (number | null)[]>;
}) {
  const [selected, setSelected] = useState(benchmarks[0]?.key ?? "");
  const benchmarkLabel =
    benchmarks.find((b) => b.key === selected)?.label ?? "Benchmark";

  const model = useMemo(() => {
    if (points.length < 2) return null;

    const rawBenchmark = series[selected] ?? [];
    // Trim/pad to the portfolio series so both lines and both return arrays
    // are index-aligned. A length mismatch would pair returns from different
    // dates and silently produce a wrong beta.
    const aligned: (number | null)[] = points.map((_, i) =>
      i < rawBenchmark.length ? rawBenchmark[i] : null
    );

    const portfolioIndex = growthIndex(points);
    const benchmarkIndex = rebaseTo100(aligned);
    const hasBenchmark = benchmarkIndex.some((v) => v !== null);

    const chartData = points.map((p, i) => ({
      date: p.date,
      portfolio: portfolioIndex[i],
      benchmark: benchmarkIndex[i],
    }));

    const stats = hasBenchmark
      ? alphaBeta(portfolioDailyReturns(points), priceReturns(aligned))
      : null;

    // The plain-language answer, derived from the same two series the chart
    // draws, so the explanation below can never contradict the lines above it.
    const verdict = stats ? benchmarkVerdict(portfolioIndex, benchmarkIndex, stats.beta) : null;

    return { chartData, stats, verdict, hasBenchmark };
  }, [points, series, selected]);

  if (points.length < 2) return null;

  const first = points[0].date;
  const last = points[points.length - 1].date;
  const windowLabel = `${longDate(first)} – ${longDate(last)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="text-sm text-ink-300">Portfolio vs benchmark</p>
          <p className="text-xs text-ink-500">
            Both rebased to 100 at {longDate(first)} · {windowLabel}
          </p>
        </div>
        <div
          role="group"
          aria-label="Benchmark index"
          className="flex rounded-md border border-ink-700 p-0.5 text-xs"
        >
          {benchmarks.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setSelected(b.key)}
              aria-pressed={selected === b.key}
              className={`rounded px-2.5 py-1 transition ${
                selected === b.key ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {model && model.stats && (
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <Stat
            label={`Alpha vs ${benchmarkLabel} (ann.)`}
            value={`${model.stats.alphaAnnual >= 0 ? "+" : ""}${(model.stats.alphaAnnual * 100).toFixed(1)}%`}
            title={`Annualized excess return over ${benchmarkLabel}, arithmetic (daily × 252). Measured over ${windowLabel}.`}
          />
          <Stat
            label="Beta"
            value={model.stats.beta.toFixed(2)}
            title={`Sensitivity to ${benchmarkLabel}: 1.00 means it moved with the index, above 1 amplified it.`}
          />
          <Stat
            label="R²"
            value={model.stats.r2.toFixed(2)}
            title={`Share of the portfolio's daily variance explained by ${benchmarkLabel}.`}
          />
          <Stat
            label="Correlation"
            value={model.stats.correlation.toFixed(2)}
            title={`Correlation of daily returns with ${benchmarkLabel}.`}
          />
          <Stat
            label="Days compared"
            value={String(model.stats.n)}
            title="Overlapping trading days actually used in the regression."
          />
        </div>
      )}

      {model?.stats && model.verdict && (
        <BenchmarkExplainer
          verdict={model.verdict}
          stats={model.stats}
          benchmarkLabel={benchmarkLabel}
          windowLabel={windowLabel}
        />
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={model?.chartData ?? []}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#a3a099", fontSize: 11 }}
              stroke="#2e2e2e"
              minTickGap={40}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => v.toFixed(0)}
              tick={{ fill: "#a3a099", fontSize: 11 }}
              stroke="#2e2e2e"
              tickLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<BenchmarkTooltip benchmarkLabel={benchmarkLabel} />}
              cursor={{ stroke: "#6b6862" }}
            />
            {/* 100 = the window's starting line; above it is a gain. */}
            <ReferenceLine y={100} stroke="#5f5c57" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke={PORTFOLIO_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: PORTFOLIO_COLOR }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke={BENCHMARK_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, fill: BENCHMARK_COLOR }}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!model?.hasBenchmark && (
        <p className="text-xs text-ink-300">
          No {benchmarkLabel} history available for this window — the benchmark line is
          hidden rather than drawn from incomplete data.
        </p>
      )}
      {model?.hasBenchmark && !model.stats && (
        <p className="text-xs text-ink-300">
          Not enough overlapping days in this window to fit alpha and beta (needs at least
          five). Widen the range.
        </p>
      )}
    </div>
  );
}
