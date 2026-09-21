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

export interface SnapshotPoint {
  date: string; // "YYYY-MM-DD"
  totalValueSgd: number;
  costBasisSgd: number;
}

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

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-ink-300">{label}</span>
      <span className="num text-ink-100">{value}</span>
    </div>
  );
}

interface TooltipPayloadItem {
  payload: SnapshotPoint & { gain: number; gainPct: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">{shortDate(point.date)}</p>
      <TooltipRow label="Total value" value={compactSgd(point.totalValueSgd)} />
      <TooltipRow label="Outlay" value={compactSgd(point.costBasisSgd)} />
      <TooltipRow
        label="Gain"
        value={`${point.gain >= 0 ? "+" : "-"}${compactSgd(Math.abs(point.gain))} (${point.gainPct >= 0 ? "+" : ""}${point.gainPct.toFixed(1)}%)`}
      />
    </div>
  );
}

/** Portfolio value over time, with outlay as a reference line. Data
 * colors are deliberately NOT the gold accent — per the palette's own
 * note, gold is UI chrome, not data. Value is a muted steel blue; the
 * outlay line is neutral ink. */
export default function PortfolioValueChart({ data }: { data: SnapshotPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="panel flex h-56 items-center justify-center p-6 text-sm text-ink-300">
        Not enough history yet — snapshots accumulate daily (run{" "}
        <code className="mx-1 rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs">
          npm run backfill
        </code>{" "}
        to reconstruct past days from the ledger).
      </div>
    );
  }

  const points = data.map((p) => ({
    ...p,
    gain: p.totalValueSgd - p.costBasisSgd,
    gainPct: p.costBasisSgd > 0 ? ((p.totalValueSgd - p.costBasisSgd) / p.costBasisSgd) * 100 : 0,
  }));
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.totalValueSgd - first.totalValueSgd;
  const changePct = first.totalValueSgd > 0 ? (change / first.totalValueSgd) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-ink-300">Portfolio value over time</p>
        <p className="num text-sm text-ink-100">
          {compactSgd(last.totalValueSgd)}
          <span className={`ml-2 ${change >= 0 ? "text-gain" : "text-loss"}`}>
            {change >= 0 ? "+" : "-"}
            {compactSgd(Math.abs(change)).replace("S$", "S$")} ({changePct >= 0 ? "+" : ""}
            {changePct.toFixed(1)}%) since {shortDate(first.date)}
          </span>
        </p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7d97b3" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7d97b3" stopOpacity={0.02} />
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
              tickFormatter={compactSgd}
              tick={{ fill: "#a3a099", fontSize: 11 }}
              stroke="#2e2e2e"
              tickLine={false}
              width={70}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#6b6862" }} />
            {/* Outlay (cost basis) as a flat dashed reference line — a
                per-point line would be identical anyway since outlay only
                steps on contribution days. Drawn as a second flat Area at
                constant y would need data juggling; ReferenceLine with y
                computed from the latest point is the simple, correct
                visual for "am I above or below what I put in". */}
            <ReferenceLine
              y={points[points.length - 1].costBasisSgd}
              stroke="#6b6862"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="totalValueSgd"
              stroke="#7d97b3"
              strokeWidth={2}
              fill="url(#valueFill)"
              dot={false}
              activeDot={{ r: 3, fill: "#7d97b3" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
