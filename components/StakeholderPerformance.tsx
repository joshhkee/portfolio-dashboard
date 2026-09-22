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
} from "recharts";
import { Money, NativeMoney, Percent, PlainPercent } from "@/components/SignedNumber";
import { seriesColor } from "@/lib/palette";
import type { StakeholderRow, StakeholderTimelinePoint } from "@/lib/stakeholders";

/** Dashed, neutral tone for "what they put in", so it never competes with the
 * coloured "what it's worth" line it is compared against. */
const CONTRIBUTED_COLOR = "#7d97b3";

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]}`;
}

function compactSgd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `S$${(n / 1_000_000).toFixed(2)}m`;
  if (Math.abs(n) >= 1_000) return `S$${(n / 1_000).toFixed(1)}k`;
  return `S$${n.toFixed(0)}`;
}

interface TooltipItem {
  payload: Record<string, number | string>;
}

function TimelineTooltip({
  active,
  payload,
  names,
  single,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  names: string[];
  single: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const date = String(row.date);
  const shown = single ? [single] : names;

  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">{shortDate(date)}</p>
      {shown.map((n, i) => (
        <div key={n} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-ink-300">
            <span
              className="inline-block h-0.5 w-3"
              style={{ background: single ? seriesColor(names.indexOf(n)) : seriesColor(i) }}
            />
            {n}
          </span>
          <span className="num text-ink-100">
            {compactSgd(Number(row[`v_${n}`] ?? 0))}
            {single && (
              <span className="ml-2 text-ink-500">
                (in {compactSgd(Number(row[`c_${n}`] ?? 0))})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Who owns what, and how each person's money is doing.
 *
 * The chart defaults to every stakeholder so the pooled shape is visible at a
 * glance, and switches to a single stakeholder to compare their value line
 * against what they actually put in — which is the question a pooled
 * portfolio otherwise can't answer.
 *
 * The table's total row is deliberate: the per-stakeholder values are
 * pro-rata slices of the same total shown on the overview, and showing the
 * sum makes that reconciliation checkable rather than asserted.
 */
export default function StakeholderPerformance({
  rows,
  timeline,
}: {
  rows: StakeholderRow[];
  timeline: StakeholderTimelinePoint[];
}) {
  const names = useMemo(() => rows.map((r) => r.name), [rows]);
  const [selected, setSelected] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      timeline.map((p) => {
        const row: Record<string, number | string> = { date: p.date };
        for (const n of names) {
          row[`v_${n}`] = p.value[n] ?? 0;
          row[`c_${n}`] = p.contributed[n] ?? 0;
        }
        return row;
      }),
    [timeline, names]
  );

  const totalContributed = rows.reduce((s, r) => s + r.contributed, 0);
  const totalValue = rows.reduce((s, r) => s + r.currentValue, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-ink-300">No outlay recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          Shares are pro-rata by contribution, so the values below add up to the portfolio
          total on the overview.
        </p>
        <div
          role="group"
          aria-label="Stakeholder to chart"
          className="flex flex-wrap rounded-md border border-ink-700 p-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-pressed={selected === null}
            className={`rounded px-2.5 py-1 transition ${
              selected === null ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
            }`}
          >
            Everyone
          </button>
          {names.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSelected(n)}
              aria-pressed={selected === n}
              className={`rounded px-2.5 py-1 transition ${
                selected === n ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="table-scroll">
        <table className="ledger-table table-compact">
          <thead>
            <tr>
              <th>Stakeholder</th>
              <th className="text-right">Contributed</th>
              <th className="text-right">Share</th>
              <th className="text-right">Current value</th>
              <th className="text-right">Gain</th>
              <th className="text-right">XIRR (ann.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name}>
                <td>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: seriesColor(i) }}
                      aria-hidden
                    />
                    <span className="text-ink-100">{r.name}</span>
                  </span>
                </td>
                <td className="num text-right">
                  <Money value={r.contributed} />
                </td>
                <td className="num text-right">
                  <PlainPercent value={r.share} />
                </td>
                <td className="num text-right">
                  <Money value={r.currentValue} />
                </td>
                <td className="num text-right">
                  <NativeMoney value={r.currentValue - r.contributed} symbol="S$" showPlus />
                </td>
                <td className="num text-right">
                  {r.xirr === null ? <span className="text-ink-500">—</span> : <Percent value={r.xirr} />}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink-600">
              <td className="text-ink-300">Total</td>
              <td className="num text-right">
                <Money value={totalContributed} />
              </td>
              <td className="num text-right text-ink-300">100.0%</td>
              <td className="num text-right">
                <Money value={totalValue} />
              </td>
              <td className="num text-right">
                <NativeMoney value={totalValue - totalContributed} symbol="S$" showPlus />
              </td>
              <td className="num text-right text-ink-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {timeline.length >= 2 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-300">
            {selected ? (
              <>
                <span className="text-ink-100">{selected}</span>: value (solid) vs contributed
                (dashed)
              </>
            ) : (
              "Value per stakeholder over time"
            )}
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  tickFormatter={compactSgd}
                  tick={{ fill: "#a3a099", fontSize: 11 }}
                  stroke="#2e2e2e"
                  tickLine={false}
                  width={60}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={
                    <TimelineTooltip names={names} single={selected} />
                  }
                  cursor={{ stroke: "#6b6862" }}
                />
                {(selected ? [selected] : names).map((n) => (
                  <Line
                    key={`v_${n}`}
                    type="monotone"
                    dataKey={`v_${n}`}
                    name={n}
                    stroke={seriesColor(names.indexOf(n))}
                    strokeWidth={selected ? 2 : 1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
                {selected && (
                  <Line
                    type="monotone"
                    dataKey={`c_${selected}`}
                    name={`${selected} contributed`}
                    stroke={CONTRIBUTED_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
