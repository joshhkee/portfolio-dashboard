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
import { NativeMoney, Percent, PlainMoney, PlainPercent } from "@/components/SignedNumber";
import SegmentedControl from "@/components/SegmentedControl";
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
    // Three blocks in a fixed order, and only the middle one grows: the controls,
    // the table (which takes what is left and scrolls its own rows), then the
    // chart. It used to be a plain column — controls, table, chart, each as tall
    // as its content — which came to ~50px more than the panel had on a laptop,
    // so the whole panel scrolled a few rows to reveal the last line of a table
    // whose own scroll region was just below. Splitting the height like this is
    // what removes that: a `.table-scroll` is a flex child with `lg:flex-1`, so
    // its box shrinks instead of the panel's content overflowing.
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          Pro-rata by contribution, so these values add up to the portfolio total.
        </p>
        <SegmentedControl
          ariaLabel="Stakeholder to chart"
          className="flex-wrap"
          options={[
            { value: null, label: "Everyone" },
            ...names.map((n) => ({ value: n, label: n })),
          ]}
          value={selected}
          onChange={setSelected}
        />
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
                {/* S$, not `Money`'s bare "$": these are SGD figures sitting
                    in the same row as an S$-labelled gain. Contributed and
                    current value are plain amounts, so they are neutral — only
                    the Gain and XIRR columns beside them carry a direction. */}
                <td className="num text-right">
                  <PlainMoney value={r.contributed} symbol="S$" />
                </td>
                <td className="num text-right">
                  <PlainPercent value={r.share} />
                </td>
                <td className="num text-right">
                  <PlainMoney value={r.currentValue} symbol="S$" />
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
                <PlainMoney value={totalContributed} symbol="S$" />
              </td>
              <td className="num text-right text-ink-300">100.0%</td>
              <td className="num text-right">
                <PlainMoney value={totalValue} symbol="S$" />
              </td>
              <td className="num text-right">
                <NativeMoney value={totalValue - totalContributed} symbol="S$" showPlus />
              </td>
              <td className="num text-right text-ink-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Keyed on the selection: going from everyone's pooled lines to one
          person's value-vs-contributed is a different question being asked of
          the same chart, and the swap-in makes that change of question legible
          rather than a jump cut. */}
      {timeline.length >= 2 && (
        <div key={selected ?? "everyone"} className="swap-in flex shrink-0 flex-col gap-2">
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
          {/* 11rem rather than the 14rem this chart used: the table above it is
              the thing being read, and a third of the panel is all a
              value-vs-contributed line needs to show a shape. */}
          <div className="h-44 w-full">
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
