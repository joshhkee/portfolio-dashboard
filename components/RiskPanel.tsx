"use client";

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
import CorrelationHeatmap from "@/components/CorrelationHeatmap";
import { formatShortDate } from "@/lib/dates";
import { Percent, formatAmount } from "@/components/SignedNumber";
import type { ConcentrationResult, LargestMove } from "@/lib/risk";

export interface RiskPositionSlice {
  key: string;
  ticker: string;
  /** Instrument name when the cache knows one, else null. */
  name: string | null;
  /** Holding value in SGD. */
  value: number;
  /** Share of total holdings value, as a fraction. */
  weight: number;
}

export interface RiskRollingPoint {
  date: string;
  value: number;
}

interface RiskPanelProps {
  concentration: ConcentrationResult;
  /** Largest positions, already sorted, capped by the caller. */
  slices: RiskPositionSlice[];
  /** Positions not shown individually, so the list can say what it's hiding. */
  hiddenCount: number;
  volatility: number | null;
  sharpe: number | null;
  annualReturn: number | null;
  riskFreeRate: number;
  /** The biggest single day, shown so one bad snapshot can't hide inside the
   * volatility figure. */
  largestMove: LargestMove | null;
  rolling: RiskRollingPoint[];
  rollingWindowDays: number;
  windowLabel: string;
  days: number;
  totalSgd: number;
}

const BAND_LABEL: Record<ConcentrationResult["band"], string> = {
  low: "diversified",
  moderate: "moderately concentrated",
  high: "concentrated",
};

/** Axis labels: day + month only, so 200 ticks stay narrow. Anything the
 * reader acts on uses formatShortDate() and carries its year. */
function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]}`;
}

/** The app's one display format, year included ("05 Mar 25"). */
function fullDate(key: string): string {
  return formatShortDate(new Date(`${key}T00:00:00Z`));
}

function Stat({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div title={title}>
      <p className="text-xs text-ink-300">{label}</p>
      <p className="num text-base font-medium text-ink-100">{value}</p>
    </div>
  );
}

interface TooltipItem {
  payload: RiskRollingPoint;
}

function RollingTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">Year to {shortDate(point.date)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Annualized</span>
        <span className={`num ${point.value >= 0 ? "text-gain" : "text-loss"}`}>
          {point.value >= 0 ? "+" : ""}
          {(point.value * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Concentration and risk statistics — the "am I carrying a risk I didn't
 * choose?" panel.
 *
 * Uses ALL available history rather than the chart range picker above it, and
 * says so in the header. That is deliberate: volatility and Sharpe are
 * estimates, and a one-month window produces a number that swings wildly and
 * means almost nothing. The rolling line inside the panel is the honest way to
 * show how the statistic has moved over time without shrinking the sample it
 * is estimated from.
 *
 * Every number here comes from lib/risk.ts as a prop computed on the server,
 * so there is exactly one implementation of each definition, and the app's
 * hard-coded risk-free assumption is printed rather than buried.
 */
export default function RiskPanel({
  concentration,
  slices,
  hiddenCount,
  volatility,
  sharpe,
  annualReturn,
  riskFreeRate,
  largestMove,
  rolling,
  rollingWindowDays,
  windowLabel,
  days,
  totalSgd,
}: RiskPanelProps) {
  // Above this share, one day is doing so much of the work that the reader
  // should know the number may be one bad snapshot rather than market risk.
  const MATERIAL_VARIANCE_SHARE = 0.15;
  const rollingStart = rolling.length > 0 ? rolling[0].date : null;
  const rollingLatest = rolling.length > 0 ? rolling[rolling.length - 1].value : null;
  const rollingBest = rolling.length > 0 ? Math.max(...rolling.map((p) => p.value)) : null;
  const rollingWorst = rolling.length > 0 ? Math.min(...rolling.map((p) => p.value)) : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-ink-300">Risk &amp; concentration</h2>
        <p className="text-xs text-ink-500">{windowLabel} · {days} days of history</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Concentration: what share of the money sits in how few names. */}
        <div className="panel flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm text-ink-300">Concentration</p>
            <p className="text-xs text-ink-500">
              HHI {(concentration.hhi * 100).toFixed(0)} of 100 ·{" "}
              <span className="text-ink-300">{BAND_LABEL[concentration.band]}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {slices.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className="num w-14 shrink-0 truncate text-xs text-ink-100"
                  title={s.name ?? s.ticker}
                >
                  {s.ticker}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                  {/* Gold by the owner's explicit choice — see "Two colours
                      that are choices, not accidents" in docs/DESIGN.md before
                      changing this. */}
                  <div
                    className="h-full rounded-full bg-accent/70"
                    style={{ width: `${(s.weight * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="num w-24 shrink-0 text-right text-xs text-ink-100">
                  S${formatAmount(s.value)}
                </span>
                <span className="num w-11 shrink-0 text-right text-xs text-ink-500">
                  {(s.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="text-xs text-ink-500">
                …and {hiddenCount} more position{hiddenCount === 1 ? "" : "s"} of S$
                {formatAmount(totalSgd - slices.reduce((sum, s) => sum + s.value, 0))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-ink-700 pt-3 sm:grid-cols-4">
            <Stat label="Positions" value={concentration.count} />
            <Stat
              label="Largest"
              value={`${(concentration.largestWeight * 100).toFixed(1)}%`}
              title="The biggest single position's share of holdings."
            />
            <Stat
              label="Top 5"
              value={`${(concentration.top5Weight * 100).toFixed(1)}%`}
              title="Combined share of the five biggest positions."
            />
            <Stat
              label="Effective N"
              value={concentration.effectiveN.toFixed(1)}
              title="1/HHI — this portfolio behaves like this many equally sized positions."
            />
          </div>

          <p className="text-xs text-ink-500">
            Holdings only, not cash. HHI: under 15 diversified, 15–25 moderate, over 25
            concentrated.
          </p>
        </div>

        {/* Risk-adjusted return, plus how it drifted over time. */}
        <div className="panel flex flex-col gap-4 p-5">
          <p className="text-sm text-ink-300">Risk-adjusted return</p>

          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Volatility"
              value={volatility === null ? "—" : `${(volatility * 100).toFixed(1)}%`}
              title="How much the daily return varies, annualised."
            />
            <Stat
              label="Sharpe"
              value={
                sharpe === null ? (
                  "—"
                ) : (
                  <span className={sharpe >= 1 ? "text-gain" : sharpe < 0 ? "text-loss" : ""}>
                    {sharpe.toFixed(2)}
                  </span>
                )
              }
              title={`Return above the ${(riskFreeRate * 100).toFixed(1)}% risk-free rate, per unit of volatility.`}
            />
            <Stat
              label="Annualized"
              value={annualReturn === null ? "—" : <Percent value={annualReturn} />}
              title="Time-weighted return over all history, annualised."
            />
          </div>

          {largestMove && (
            <p className="text-xs text-ink-500">
              Largest single day <span className={largestMove.value >= 0 ? "text-gain" : "text-loss"}>
                {`${largestMove.value >= 0 ? "+" : ""}${(largestMove.value * 100).toFixed(1)}%`}
              </span>{" "}
              on {fullDate(largestMove.date)}
              {largestMove.varianceShare >= MATERIAL_VARIANCE_SHARE && (
                <> — on its own it explains {(largestMove.varianceShare * 100).toFixed(0)}% of the volatility above</>
              )}
              .
            </p>
          )}

          {rolling.length >= 2 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-xs text-ink-300">
                  Rolling {rollingWindowDays === 365 ? "1-year" : `${rollingWindowDays}-day`}{" "}
                  annualized return
                </p>
                <p className="num text-xs text-ink-500">
                  {rollingLatest !== null && (
                    <>
                      now{" "}
                      <span className={rollingLatest >= 0 ? "text-gain" : "text-loss"}>
                        {rollingLatest >= 0 ? "+" : ""}
                        {(rollingLatest * 100).toFixed(1)}%
                      </span>
                      {" · "}
                    </>
                  )}
                  range {(rollingWorst! * 100).toFixed(1)}% to {(rollingBest! * 100).toFixed(1)}%
                </p>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rolling} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fill: "#a3a099", fontSize: 11 }}
                      stroke="#2e2e2e"
                      tickLine={false}
                      width={56}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip content={<RollingTooltip />} cursor={{ stroke: "#6b6862" }} />
                    {/* Break-even line: above it the trailing year made money. */}
                    <ReferenceLine y={0} stroke="#5f5c57" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#d4a94a"
                      strokeWidth={1.6}
                      dot={false}
                      activeDot={{ r: 3, fill: "#d4a94a" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-ink-500">
                The trailing year&apos;s return, recalculated each day. Starts{" "}
                {fullDate(rollingStart!)} — the first day with a full year behind it.
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-500">
              Rolling returns appear once there is a full year of snapshots.
            </p>
          )}
        </div>
      </div>

      {/* Reuses the app's gain/loss tones so the reading needs no new legend. */}
      <div className="panel flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink-300">How the holdings move together</p>
          <p className="text-xs text-ink-500">6 months of daily returns · pair by pair</p>
        </div>
        <CorrelationHeatmap />
      </div>
    </section>
  );
}
