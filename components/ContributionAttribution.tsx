"use client";

import { useMemo, useState } from "react";
import SegmentedControl from "@/components/SegmentedControl";
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
        <SegmentedControl
          ariaLabel="Period grouping"
          options={[
            { value: "month", label: "By month" },
            { value: "quarter", label: "By quarter" },
          ]}
          value={period}
          onChange={setPeriod}
        />

        <SegmentedControl
          ariaLabel="Time range"
          options={RANGE_KEYS.map((key) => ({ value: key, label: key === "ALL" ? "All" : key }))}
          value={range}
          onChange={setRange}
        />
      </div>

      {/* The answer, up top, in the units the question was asked in. Keyed on
          both controls, so switching range OR period replays the swap-in — and
          since the table below shares the key's commit, the two animate as one
          motion rather than as two panels that happen to be changing. */}
      <div
        key={`summary-${range}-${period}`}
        className="swap-in grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <div className="panel p-5 lg:col-span-2">
          <p className="text-xs text-ink-300">
            Portfolio gain over {table.columns.length} {period}
            {table.columns.length === 1 ? "" : "s"}
          </p>
          <p className="stat-value">
            <NativeMoney value={table.total} symbol={sgd} showPlus />
          </p>
          <p className="mt-2 text-xs text-ink-300">
            {winners.length} position{winners.length === 1 ? "" : "s"} added, {losers.length}{" "}
            subtracted. Money paid in or taken out is not a gain, so this is what the holdings
            earned.
          </p>
          {/* Only shown when stored values exist to check against. */}
          {table.snapshotGain.some((v) => v !== 0) && (
            // Kept, and deliberately: this is the one line that says the two
            // ways of pricing the same periods disagree, so the figures above
            // cannot be read as a blend of them.
            <p className="mt-2 text-xs text-ink-500">
              Cross-check against the stored daily values:{" "}
              <span className="num">{formatSigned(snapshotTotal)}</span>, a{" "}
              <span className={`num ${toneClass(residual)}`}>{formatSigned(residual)}</span>{" "}
              difference — the two price histories disagree on a few days, so every figure comes
              from the ledger alone.
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
                  {/* Same figure as the table, in the same units — the
                      currency symbol belongs on it too, since every other
                      money value in the app carries one. */}
                  <span className={`w-24 shrink-0 text-right text-xs ${toneClass(row.total)}`}>
                    <NativeMoney value={row.total} symbol={sgd} showPlus />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div key={`table-${range}-${period}`} className="swap-in table-scroll">
        {/* `table-compact` is width, not style: this grid grows a column per
            month, so at 19 months it is 21 columns wide and the denser variant
            is what puts a year of them on screen without scrolling. The
            ledger-shaped tables (positions, trades) stay at text-sm — this is
            the one table whose column count is unbounded. */}
        <table className="ledger-table table-compact">
          <thead>
            <tr>
              <th className="cell-pin">Instrument</th>
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
                <td className="cell-pin">
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
                {/* The Total column carries the currency symbol while the
                    period cells do not: it is the same figure as the headline
                    above, which shows S$, and a column of symbols in the
                    per-period grid would cost real width for no new meaning
                    (the caption states the units). */}
                <td className="text-right font-medium">
                  <NativeMoney value={row.total} symbol={sgd} showPlus />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-600">
              <td className="cell-pin text-ink-300">Total</td>
              {table.columnTotals.map((value, i) => (
                <td key={table.columns[i].key} className={`num text-right ${toneClass(value)}`}>
                  {formatSigned(value)}
                </td>
              ))}
              <td className="text-right font-medium">
                <NativeMoney value={table.total} symbol={sgd} showPlus />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-ink-500">
        Each cell is that position&apos;s gain in that period, net of money paid in or taken out.
        Every figure is in SGD.
      </p>
    </div>
  );
}
