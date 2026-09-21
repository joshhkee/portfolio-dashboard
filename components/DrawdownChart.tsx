"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { drawdownSeries, type PerfPoint } from "@/lib/performance";

function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]}`;
}

interface TooltipItem {
  payload: { date: string; drawdown: number };
}

function DrawdownTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">{shortDate(point.date)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Below peak</span>
        <span className="num text-loss">{(point.drawdown * 100).toFixed(2)}%</span>
      </div>
    </div>
  );
}

/**
 * The "underwater" curve: how far below its previous high the portfolio sat on
 * each day, as a percentage. Reads as flat along the top when at new highs and
 * dips down through drawdowns.
 *
 * Shares drawdownSeries() with maxDrawdown(), so the worst point of this curve
 * is always the same number reported on the overview.
 *
 * Coloured with the loss tone by design — this chart only ever shows losses,
 * so a neutral or gain colour would misrepresent it.
 */
export default function DrawdownChart({ data }: { data: PerfPoint[] }) {
  const series = drawdownSeries(data);
  if (series.length < 2) return null;

  const worst = Math.min(...series.map((s) => s.drawdown));
  const current = series[series.length - 1].drawdown;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-ink-300">Drawdown from peak</p>
        <p className="num text-sm">
          <span className="text-ink-300">now </span>
          <span className={current === 0 ? "text-ink-100" : "text-loss"}>
            {(current * 100).toFixed(2)}%
          </span>
          <span className="ml-3 text-ink-300">worst in view </span>
          <span className="text-loss">{(worst * 100).toFixed(2)}%</span>
        </p>
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c07f74" stopOpacity={0.04} />
                <stop offset="100%" stopColor="#c07f74" stopOpacity={0.3} />
              </linearGradient>
            </defs>
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
              width={70}
              domain={[worst * 1.15, 0]}
              allowDataOverflow={false}
            />
            <Tooltip content={<DrawdownTooltip />} cursor={{ stroke: "#6b6862" }} />
            {/* Zero line = a new high. */}
            <ReferenceLine y={0} stroke="#5f5c57" />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#c07f74"
              strokeWidth={1.5}
              fill="url(#drawdownFill)"
              dot={false}
              activeDot={{ r: 3, fill: "#c07f74" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
