"use client";

import { useMemo, useState } from "react";
import { RANGE_KEYS, type RangeKey } from "@/lib/performance";
import {
  groupByQuarter,
  rangeIndices,
  selectColumns,
  type AttributionMatrix,
} from "@/lib/attribution";
import { NativeMoney, formatAmount } from "@/components/SignedNumber";

const sgd = "S$";

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatAmount(Math.abs(value))}`;
}

function toneClass(value: number): string {
  return value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-300";
}

/**
 * Which holding, and which period, produced the result.
 *
 * The grid is computed for ALL history on the server and sliced here, because
 * recomputing per range would mean re-fetching years of daily bars for every
 * ticker every time a button is pressed — the same trade the other charts make.
 *
 * Rows are positions (including fully closed ones: their realized gain really
 * happened), columns are periods, and every cell is the position's GAIN in that
 * period — value change with money paid in or taken out removed. So a position
 * you kept buying into all year contributes only what it earned.
 *
 * The range picker is the app's shared one, and the snapshot cross-check sits
 * beside the total on purpose: the grid is built from the ledger while the
 * snapshot series is stored daily values including cash, and a reconciliation
 * the reader can see is worth more than one buried in a comment.
 */
export default function ContributionAttribution({ matrix }: { matrix: AttributionMatrix }) {
  const [range, setRange] = useState<RangeKey>("ALL");
  const [period, setPeriod] = useState<"month" | "quarter">("month");

  const table = useMemo(() => {
    const narrowed = selectColumns(matrix, rangeIndices(matrix.columns, range));
    return period === "quarter" ? groupByQuarter(narrowed) : narrowed;
  }, [matrix, range, period]);

  // Biggest contributor first FOR THE SELECTED RANGE — the server's order
  // covers all history, which is the wrong question once a window is chosen.
  const rows = useMemo(
    () => [...table.rows].sort((a, b) => b.total - a.total),
    [table]
  );

  const snapshotTotal = table.snapshotGain.reduce((sum, v) => sum + v, 0);
  const residual = snapshotTotal - table.total;
  const winners = rows.filter((r) => r.total > 0);
  const losers = rows.filter((r) => r.total < 0);
  const largest = Math.max(0, ...rows.map((r) => Math.abs(r.total)));
  const headline = rows.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Period grouping"
          className="flex rounded-md border border-ink-700 p-0.5 text-xs"
        >
          {(["month", "quarter"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              aria-pressed={period === key}
              className={`rounded px-2.5 py-1 capitalize transition motion-reduce:transition-none ${
                period === key ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              By {key}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Time range"
          className="flex rounded-md border border-ink-700 p-0.5 text-xs"
        >
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={`rounded px-2.5 py-1 transition motion-reduce:transition-none ${
                range === key ? "bg-accent text-ink-950" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
      </div>

      {/* The answer, up top, in the units the question was asked in. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <p className="text-xs text-ink-300">
            Portfolio gain over {table.columns.length} {period}
            {table.columns.length === 1 ? "" : "s"}
          </p>
          <p className="num mt-1 text-3xl font-medium">
            <NativeMoney value={table.total} symbol={sgd} showPlus />
          </p>
          <p className="mt-2 text-xs text-ink-300">
            {winners.length} position{winners.length === 1 ? "" : "s"} added, {losers.length}{" "}
            subtracted — money paid in or taken out is not counted as a gain, so this is what the
            holdings actually earned over the window.
          </p>
          {/* Only shown when stored values exist to check against. */}
          {table.snapshotGain.some((v) => v !== 0) && (
            <p className="mt-2 text-xs text-ink-500">
              Cross-check: pricing the same periods from the stored daily holdings values gives{" "}
              <span className="num">{formatSigned(snapshotTotal)}</span>, a{" "}
              <span className={`num ${toneClass(residual)}`}>{formatSigned(residual)}</span>{" "}
              difference from the grid — the two price histories disagreeing on a few days, which is
              why every figure above comes from the ledger rather than from a blend of the two.
            </p>
          )}
        </div>

        <div className="panel flex flex-col gap-2 p-5">
          <p className="text-xs text-ink-300">Biggest contributors</p>
          {headline.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing in this window.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {headline.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <span className="num w-14 shrink-0 truncate text-xs text-ink-100" title={row.name ?? row.ticker}>
                    {row.ticker}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                    {/* Gold by the owner's explicit choice — see the `data`
                        palette note in docs/PLAN.md before changing this. */}
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${largest === 0 ? 0 : (Math.abs(row.total) / largest) * 100}%` }}
                    />
                  </div>
                  <span className={`num w-24 shrink-0 text-right text-xs ${toneClass(row.total)}`}>
                    {formatSigned(row.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-ink-850">Instrument</th>
              {table.columns.map((column) => (
                <th key={column.key} className="text-right" title={`Ends ${column.endDay}`}>
                  {column.label}
                </th>
              ))}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="sticky left-0 z-10 bg-ink-900">
                  <span className="flex items-baseline gap-2">
                    <span className="num text-ink-100">{row.ticker}</span>
                    {row.openQty <= 0 && (
                      <span className="text-[10px] text-ink-500" title="Position fully closed — this is its realized gain, which still counts.">
                        closed
                      </span>
                    )}
                  </span>
                  {row.name && (
                    <span className="block max-w-[160px] truncate text-xs text-ink-300" title={row.name}>
                      {row.name}
                    </span>
                  )}
                </td>
                {row.values.map((value, i) => (
                  <td key={table.columns[i].key} className={`num text-right ${toneClass(value)}`}>
                    {value === 0 ? <span className="text-ink-500">—</span> : formatSigned(value)}
                  </td>
                ))}
                <td className={`num text-right font-medium ${toneClass(row.total)}`}>
                  {formatSigned(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-600">
              <td className="sticky left-0 z-10 bg-ink-900 text-ink-300">Total</td>
              {table.columnTotals.map((value, i) => (
                <td key={table.columns[i].key} className={`num text-right ${toneClass(value)}`}>
                  {formatSigned(value)}
                </td>
              ))}
              <td className={`num text-right font-medium ${toneClass(table.total)}`}>
                {formatSigned(table.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-ink-500">
        A cell is one position&apos;s gain in one period: its value moved that much, minus whatever
        was paid in or taken out. Cells in a row or column always add up to the totals beside them.
      </p>
    </div>
  );
}
