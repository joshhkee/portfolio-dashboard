"use client";

import { useMemo, useState } from "react";
import SegmentedControl from "@/components/SegmentedControl";
import { RANGE_KEYS, type RangeKey } from "@/lib/performance";
import {
  groupByQuarter,
  rangeIndices,
  selectColumns,
  type AttributionColumn,
  type AttributionMatrix,
} from "@/lib/attribution";
import { NativeMoney, formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";

const sgd = "S$";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The first month or quarter in the window, from a column key ("2024-09" or
 *  "2024-Q3"). The grid's own keys rather than a date parse, because a quarter
 *  is not a date. */
function windowStart(key: string): string {
  const [year, part] = key.split("-");
  if (!part) return key;
  if (part.startsWith("Q")) return `${part} ${year}`;
  return `${MONTHS[Number(part) - 1]} ${year.slice(2)}`;
}

/**
 * "Sep 24 – 30 Sep 26 · 25 months" — the window the figure above covers,
 * derived from the columns that are actually on screen.
 *
 * The panel used to say "portfolio gain over 19 months", a number typed into
 * the copy that was right for exactly one range setting: choosing "1Y" left it
 * claiming nineteen months over a twelve-month table. Everything here comes from
 * `columns` — the same array the table renders — so the caption and the grid
 * cannot describe different windows.
 */
function windowCaption(columns: AttributionColumn[], period: "month" | "quarter"): string {
  if (columns.length === 0) return "";
  // Both ends as period labels ("Mar 25 – Sep 26") rather than a month against
  // a date: the grid is periods, and the first and last period are partial at
  // the edges, so pinning the tail to an exact day would claim a precision the
  // figures do not have. The day each period ends is in its own column's title.
  const start = windowStart(columns[0].key);
  const end = windowStart(columns[columns.length - 1].key);
  return `${start} – ${end} · ${columns.length} ${period}${columns.length === 1 ? "" : "s"}`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatAmount(Math.abs(value))}`;
}

/** The same figure with its unit, for the one place in this grid where a number
 *  is read as prose rather than under a column heading that states the
 *  currency. */
function formatSignedSgd(value: number): string {
  return `${value >= 0 ? "+" : "-"}${sgd}${formatAmount(Math.abs(value))}`;
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
export default function ContributionAttribution({
  matrix,
  cash,
}: {
  matrix: AttributionMatrix;
  /** The cash reconciliation, measured on the server because it needs the
   *  contribution ledger and the recorded balances — facts this grid never
   *  touches. It is rendered in the summary panel rather than on a row of its
   *  own below the table, which is what gives the grid that row's height. */
  cash: { gap: number; implied: number; held: number; contributed: number };
}) {
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
  const largest = Math.max(0, ...rows.map((r) => Math.abs(r.total)));
  const headline = rows.slice(0, 6);

  // The window, and the one sentence worth putting under a figure of this size:
  // WHO produced it and how concentrated it was. Both read off the rows already
  // sorted for this range, so they change when the window or the grouping does —
  // which is the whole complaint about the line this replaces, a hand-written
  // "over 19 months" that stayed 19 months after you chose "1Y".
  const caption = windowCaption(table.columns, period);
  const lead = rows.find((r) => r.total > 0) ?? null;
  const drag = [...rows].reverse().find((r) => r.total < 0) ?? null;
  const leadShare = lead && table.total > 0 ? lead.total / table.total : null;
  const headlineSentence = lead
    ? [
        `${lead.ticker} leads at ${formatSignedSgd(lead.total)}${leadShare === null ? "" : ` — ${(leadShare * 100).toFixed(0)}% of the gain`}`,
        `${winners.length} of ${rows.length} position${rows.length === 1 ? "" : "s"} up`,
        drag ? `${drag.ticker} is the biggest drag at ${formatSignedSgd(drag.total)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Nothing in this window finished ahead.";

  return (
    // The controls and the summary are a fixed cost; the grid takes what is
    // left and scrolls both ways inside its own box, which is what puts the two
    // segmented controls and the headline figure on the screen at the same time
    // as a year of columns.
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
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
        <div className="panel flex flex-col gap-2 p-4 lg:col-span-2">
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-300">
            {/* The definition of the figure lives on its label (§8.7): the
                sentence that used to sit under it saying "money paid in is not
                a gain" is one hover from the word "gain". */}
            <span title="Gain only: money paid in or taken out is removed from every cell, so this is what the holdings earned rather than what was deposited.">
              Portfolio gain
            </span>
            {caption && <span className="text-ink-500">{caption}</span>}
          </p>
          <p className="stat-value">
            <NativeMoney value={table.total} symbol={sgd} showPlus />
          </p>
          <p className="text-xs text-ink-300">{headlineSentence}</p>
          {/* Kept, and deliberately: this is the one line that says the two
              ways of pricing the same periods disagree, so the figures above
              cannot be read as a blend of them. */}
          {table.snapshotGain.some((v) => v !== 0) && (
            <p className="text-xs text-ink-500">
              Stored daily values say <span className="num">{formatSigned(snapshotTotal)}</span>, a{" "}
              <span className={`num ${toneClass(residual)}`}>{formatSigned(residual)}</span>{" "}
              difference — so every figure here comes from the ledger alone.
            </p>
          )}
          {/* The cash reconciliation, moved off the row it used to occupy below
              the table and onto the panel that already reports how this grid
              lines up with the other ways of measuring the same thing. The gap
              is the recorded balances drifting from the ledger, not an error in
              a grid that never touches cash — which is the whole of its
              tooltip. */}
          <p className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-500">
            <span
              className="num"
              title={`The ledger says S$${formatAmount(cash.implied)} of the S$${formatAmount(cash.contributed)} contributed should still be uninvested after what was spent on trades; the recorded balances hold S$${formatAmount(cash.held)}. Cash is hand-maintained, so a gap here is the ledger and the balances drifting apart rather than an error in this grid.`}
            >
              Cash check: S${formatAmount(cash.gap)} difference
            </span>
            {matrix.fxFallbacks > 0 && (
              <span
                className="num"
                title={`${matrix.fxFallbacks} date${matrix.fxFallbacks === 1 ? "" : "s"} predate the available FX history and were costed at today's rate, so the currency effect on those amounts is understated rather than invented.`}
              >
                · {matrix.fxFallbacks} date{matrix.fxFallbacks === 1 ? "" : "s"} at today&apos;s rate
              </span>
            )}
          </p>
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
                    {/* Gold by the owner's explicit choice — see "Two colours
                        that are choices, not accidents" in docs/DESIGN.md before
                        changing this. */}
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
              {/* The scope of the whole grid lives on its first and last
                  column headers now. It was a paragraph above the table —
                  "26 instruments ever traded, measured from …" on one side and
                  "every instrument priced from history" on the other — which
                  spent two lines of the screen telling the reader what the
                  rows and the tooltips already said, on the one page whose
                  problem is table height. */}
              <th
                className="cell-pin"
                title={[
                  `${matrix.rows.length} instrument${matrix.rows.length === 1 ? "" : "s"} ever traded, measured from ${formatShortDate(new Date(`${matrix.baselineDay}T00:00:00Z`))}.`,
                  "Positions only · no fees · nothing stored.",
                  matrix.unpriced.length > 0
                    ? `No price history, so valued at cost (a zero gain rather than a fabricated one): ${matrix.unpriced.map((k) => k.split("::")[1]).join(", ")}.`
                    : "Every instrument priced from history.",
                  "A row marked closed is a position sold entirely — its realized gain still happened and still counts.",
                ].join(" ")}
              >
                Instrument
              </th>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  className="text-right"
                  title={`Gain in the period ending ${formatShortDate(new Date(`${column.endDay}T00:00:00Z`))}, net of money paid in or taken out. Every figure is in SGD.`}
                >
                  {column.label}
                </th>
              ))}
              <th
                className="text-right"
                title="The row's gain across every period in the window, net of money paid in or taken out. Every figure is in SGD."
              >
                Total
              </th>
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
    </div>
  );
}
