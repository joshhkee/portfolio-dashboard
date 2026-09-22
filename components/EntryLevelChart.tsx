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
import { formatAmount } from "@/lib/format";
import type { EntrySeries } from "@/lib/entry-signals";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-26" -> "26 May", which is how every other date in the app reads. */
function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

interface Point {
  date: string;
  close: number;
  sma50: number | null;
}

function PriceTooltip({
  active,
  payload,
  symbol,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  symbol: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="panel border-ink-600 bg-ink-850 p-3 text-xs shadow-xl">
      <p className="mb-1.5 text-ink-300">{shortDate(point.date)}</p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-ink-300">Close</span>
        <span className="num text-ink-100">
          {symbol}
          {formatAmount(point.close)}
        </span>
      </div>
      {point.sma50 !== null && (
        <div className="mt-0.5 flex items-center justify-between gap-6">
          <span className="text-ink-300">50-day avg</span>
          <span className="num text-ink-300">
            {symbol}
            {formatAmount(point.sma50)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A year of daily closes, with the two levels an entry decision actually refers
 * to: the window's low and high, and the 50-day average.
 *
 * The point of this chart on a watchlist row is choosing a level, so the two
 * things worth drawing ON it are the bounds of the range — where a limit order
 * would sit relative to the year — and the average the tiles already compare the
 * price against. Volume was offered and not taken: it answers "was there
 * conviction", not "where would I buy".
 *
 * Colours follow the app's own rule for multi-series charts: the price is the
 * primary series and keeps the brand gold, and the average is a reference drawn
 * in the muted data steel, which was chosen against the page background for
 * exactly this kind of overlay. The dashed levels are chrome, not data, so they
 * are the ink greys.
 */
export default function EntryLevelChart({
  series,
  symbol,
  low,
  high,
}: {
  series: EntrySeries;
  symbol: string;
  low: number | null;
  high: number | null;
}) {
  const data: Point[] = series.dates.map((date, i) => ({
    date,
    close: series.closes[i],
    sma50: series.sma50Line[i] ?? null,
  }));
  if (data.length < 2) return null;

  const values = data.map((d) => d.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A little headroom so a level drawn exactly at the extreme is not clipped by
  // the plot edge.
  const pad = (max - min) * 0.08 || max * 0.02 || 1;

  const hasAverage = data.some((d) => d.sma50 !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-300">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-accent" />
          Price
        </span>
        {hasAverage && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 bg-data-steel" />
            50-day average
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 border-t border-dashed border-ink-500" />
          1-year low / high
        </span>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "#a3a099", fontSize: 11 }}
              stroke="#2e2e2e"
              minTickGap={56}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${symbol}${formatAmount(v)}`}
              tick={{ fill: "#a3a099", fontSize: 11 }}
              stroke="#2e2e2e"
              tickLine={false}
              width={72}
              domain={[min - pad, max + pad]}
              allowDataOverflow={false}
            />
            <Tooltip
              content={<PriceTooltip symbol={symbol} />}
              cursor={{ stroke: "#6b6862" }}
            />
            {low !== null && (
              <ReferenceLine y={low} stroke="#5f5c57" strokeDasharray="4 4" />
            )}
            {high !== null && (
              <ReferenceLine y={high} stroke="#5f5c57" strokeDasharray="4 4" />
            )}
            {hasAverage && (
              <Line
                type="monotone"
                dataKey="sma50"
                stroke="#7d97b3"
                strokeWidth={1.2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#d4a94a"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#d4a94a" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-ink-500">
        Daily closes over the last year. A level near the dashed low is a cheaper entry than
        today&apos;s price and a worse one than waiting; the average is the line the tiles above
        compare against.
      </p>
    </div>
  );
}
