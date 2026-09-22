// Contribution attribution — "which holding, and which period, made this
// result?"
//
// A single return number can't answer that, and a value chart can't either:
// the chart shows what the portfolio grew to, not who grew it. This module
// splits the portfolio's GAIN (change in value with new money removed) into a
// position × period grid.
//
// The definition, for a position p over a period ending at day t (with the
// previous period ending at day t−1):
//
//     contribution = V_p(t) − V_p(t−1) − netCash_p
//
// where V is the position's SGD market value and netCash is what was PAID for
// shares bought in the period, less what was received for shares sold. Money
// moved into a position is therefore not a contribution — putting S$1,000 into
// VOO and having it still be worth S$1,000 contributes exactly 0.
//
// Why this closes: summed over every position, the value terms telescope and
// the cash terms cancel against the money that left the portfolio to buy them,
// leaving (change in holdings value − net purchases), which is exactly the
// portfolio's gain over the same span. A test pins that summing the monthly
// columns equals the same computation done as ONE period, so the period split
// reassigns nothing.
//
// Scope: positions only, and the app's Non-goals are respected — no fees (the
// owner considers them negligible) and no target allocation.

import { priceKey, alignCloses, type HistoricalCloses } from "@/lib/prices";
import { positionsAsOf, type RawTransaction } from "@/lib/portfolio-engine";
import { rangeStartMs, type RangeKey } from "@/lib/performance";

const DAY_MS = 86_400_000;

function dayMs(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getTime();
}

/** "YYYY-MM-DD" of the UTC calendar day `offset` days from `day`. */
function shiftDay(day: string, offset: number): string {
  return new Date(dayMs(day) + offset * DAY_MS).toISOString().slice(0, 10);
}

export function dayKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last UTC calendar day of a "YYYY-MM" month. */
export function monthEnd(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  // Day 0 of the NEXT month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Every "YYYY-MM" from the month of `from` to the month of `to`, oldest first. */
export function monthKeysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth() + 1;
  const endYear = to.getUTCFullYear();
  const endMonth = to.getUTCMonth() + 1;

  // Bounded so a corrupt date can't spin forever.
  for (let guard = 0; guard < 1200; guard++) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    if (year === endYear && month === endMonth) break;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

/** The close on a day, carrying the last trading day's close forward. Returns
 * null when the series has nothing at or before that day. */
export function closeOn(closes: HistoricalCloses | undefined, day: string): number | null {
  if (!closes || Object.keys(closes).length === 0) return null;
  const [value] = alignCloses([day], closes);
  return value ?? null;
}

/**
 * The stored holdings value on a day — the last snapshot at or before it.
 *
 * Only the HOLDINGS component is read, never cash. The daily snapshot's cash
 * figure is a single hand-maintained balance model reconstructed backwards,
 * so it is not an independent measurement of anything; the grid's scope is
 * positions, and comparing against a cash series would measure that model's
 * drift rather than whether the two PRICE histories agree.
 *
 * Zero before the series starts, which is the honest reading: nothing was
 * recorded, so nothing is claimed.
 */
export function holdingsValueOn(snapshots: PerfLike[], day: string): number {
  let value = 0;
  for (const s of snapshots) {
    if (s.date > day) break;
    value = s.holdingsValueSgd;
  }
  return value;
}

/** Just the shape holdingsValueOn() needs — DailySnapshot as getSnapshots
 * returns it, without importing the DB-backed module for a type. */
export interface PerfLike {
  date: string;
  holdingsValueSgd: number;
}

export interface AttributionColumn {
  /** "YYYY-MM", or "YYYY-Qn" after quarter grouping. */
  key: string;
  /** Short display label, e.g. "Sep 26". */
  label: string;
  /** Last day of the period — what the range filter compares against. */
  endDay: string;
}

export interface AttributionRow {
  /** Compound "REGION::TICKER". */
  key: string;
  region: string;
  ticker: string;
  name: string | null;
  /** Contribution per column, same order as `columns`. */
  values: number[];
  /** Sum of `values`. */
  total: number;
  /** Shares still held — 0 means the position was closed inside this history,
   * which is why closed names still appear: their realized gain contributed. */
  openQty: number;
}

export interface AttributionMatrix {
  columns: AttributionColumn[];
  rows: AttributionRow[];
  /** Sum of each column's contributions. */
  columnTotals: number[];
  /** Grand total — the portfolio's gain across every column. */
  total: number;
  /**
   * The same gain per column, recomputed from the snapshots' stored holdings
   * values instead of from the ledger replay. Parallel to `columns`. Used only
   * as a cross-check on pricing, never as the source of the figures above —
   * rows and totals all come from the ledger.
   */
  snapshotGain: number[];
  /** Positions valued at cost because no price series was available. Their
   * contribution is genuinely unmeasurable, and is reported as 0. */
  unpriced: string[];
  /** Purchases costed at a fallback FX rate because history didn't reach. */
  fxFallbacks: number;
  /**
   * Net cash the ledger says went INTO positions over the whole history
   * (purchases minus sale proceeds), in SGD. Exposed so a caller can ask what
   * the ledger implies should still be in cash — contributions less this — and
   * compare it with the recorded balances.
   */
  netInvestedTotal: number;
  /** The day the whole grid is measured FROM (the day before the first trade). */
  baselineDay: string;
}

export interface AttributionInput {
  transactions: RawTransaction[];
  /** Historical closes per compound key, for period-end pricing. */
  closes: Record<string, HistoricalCloses>;
  /** SGD per one unit of the position's currency on a day. Must be total:
   * callers fall back to today's rate and count it separately. */
  sgdRate: (region: string, day: string) => { rate: number; fallback: boolean };
  /** Instrument names, by compound key. */
  names?: Record<string, string>;
  /**
   * Daily stored holdings values, for the cross-check. Optional: without them
   * the grid still computes, it just has nothing to check itself against.
   */
  snapshots?: PerfLike[];
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_ABBR[month - 1]} ${String(year).slice(-2)}`;
}

/**
 * Build the position × month contribution grid for the entire ledger.
 *
 * Computed for ALL history on the server, and sliced to a range on the client
 * — the same trade the charts make. Recomputing per range would need a fresh
 * historical-price fetch per button press for every ticker ever traded.
 */
export function contributionAttribution(
  input: AttributionInput,
  today: string
): AttributionMatrix {
  const txns = input.transactions;
  const empty: AttributionMatrix = {
    columns: [],
    rows: [],
    columnTotals: [],
    total: 0,
    snapshotGain: [],
    unpriced: [],
    fxFallbacks: 0,
    netInvestedTotal: 0,
    baselineDay: today,
  };
  if (txns.length === 0) return empty;

  const firstDay = txns.reduce(
    (min, t) => (dayKeyOf(t.date) < min ? dayKeyOf(t.date) : min),
    dayKeyOf(txns[0].date)
  );
  // Baseline is the day BEFORE the first trade, so no position exists yet and
  // the first period owns every share bought in it.
  const baselineDay = shiftDay(firstDay, -1);

  const months = monthKeysBetween(new Date(`${firstDay}T00:00:00.000Z`), new Date(`${today}T00:00:00.000Z`));
  // The current month ends today, not on the calendar's last day.
  const boundaries = [baselineDay, ...months.map((m) => (monthEnd(m) < today ? monthEnd(m) : today))];

  // Every instrument the ledger has ever traded, including fully closed ones.
  const instruments = Array.from(
    new Map(
      txns.map((t) => [priceKey(t.region, t.ticker), { region: t.region, ticker: t.ticker }])
    ).values()
  ).sort((a, b) => priceKey(a.region, a.ticker).localeCompare(priceKey(b.region, b.ticker)));

  // Distinct (region, day) pairs that needed a fallback, not the number of
  // lookups — a single unpriced day is asked for once per boundary, and
  // reporting "14 fallbacks" when 2 dates were involved would misrepresent it.
  const fxFallbackKeys = new Set<string>();
  const rateAt = (region: string, day: string): number => {
    const { rate, fallback } = input.sgdRate(region, day);
    if (fallback) fxFallbackKeys.add(`${region}@${day}`);
    return rate;
  };

  // Instrument key -> row index, so the cash pass below stays linear instead of
  // scanning the instrument list per transaction.
  const rowOf = new Map(
    instruments.map((inst, i) => [priceKey(inst.region, inst.ticker), i])
  );

  // Market value of every instrument at every boundary, by row index.
  const unpricedSet = new Set<string>();
  const values: number[][] = boundaries.map((day) => {
    const held = positionsAsOf(txns, day);
    const byKey = new Map(held.map((p) => [priceKey(p.region, p.ticker), p]));
    return instruments.map((inst) => {
      const key = priceKey(inst.region, inst.ticker);
      const position = byKey.get(key);
      if (!position || position.qty <= 0) return 0;
      const series = input.closes[key];
      const hasSeries = !!series && Object.keys(series).length > 0;
      if (!hasSeries) unpricedSet.add(key);
      // No usable close → value at cost. That makes the position's
      // contribution exactly its cash flow (i.e. a 0 gain), which is honest:
      // an unmeasured price cannot contribute a measured gain.
      const price = (hasSeries ? closeOn(series, day) : null) ?? position.avgCost;
      return position.qty * price * rateAt(inst.region, day);
    });
  });

  const monthCount = months.length;
  const grid: number[][] = instruments.map(() => new Array(monthCount).fill(0));

  const previous = boundaries.slice(0, -1);
  const current = boundaries.slice(1);
  const netInvested = new Array(monthCount).fill(0);
  for (let k = 0; k < monthCount; k++) {
    const fromMs = dayMs(previous[k]);
    const toMs = dayMs(current[k]);

    // Movement in market value over the period.
    for (let i = 0; i < instruments.length; i++) {
      grid[i][k] = values[k + 1][i] - values[k][i];
    }

    // The snapshots' own holdings-value change for the same period, kept so the
    // cross-check below can subtract the SAME cash term the grid does.

    // Then remove the money that moved IN (or out), in SGD at each trade's own
    // date's rate. A Sell returns money to the portfolio, hence the negative
    // sign — which is what makes a profitable exit read as a gain rather than
    // as a loss equal to the whole position.
    for (const t of txns) {
      const ms = t.date.getTime();
      if (ms <= fromMs || ms > toMs) continue;
      const row = rowOf.get(priceKey(t.region, t.ticker));
      if (row === undefined) continue;
      const signed = (t.action === "Buy" ? 1 : -1) * t.qty * t.price * rateAt(t.region, dayKeyOf(t.date));
      grid[row][k] -= signed;
      netInvested[k] += signed;
    }
  }

  const finalQty = new Map(
    positionsAsOf(txns, today).map((p) => [priceKey(p.region, p.ticker), p.qty])
  );

  const rows: AttributionRow[] = instruments.map((inst, i) => {
    const key = priceKey(inst.region, inst.ticker);
    const valuesForRow = grid[i];
    return {
      key,
      region: inst.region,
      ticker: inst.ticker,
      name: input.names?.[key] ?? null,
      values: valuesForRow,
      total: valuesForRow.reduce((sum, v) => sum + v, 0),
      openQty: finalQty.get(key) ?? 0,
    };
  });
  rows.sort((a, b) => b.total - a.total);

  const columnTotals = months.map((_, k) => rows.reduce((sum, r) => sum + r.values[k], 0));

  return {
    columns: months.map((m, k) => ({
      key: m,
      label: monthLabel(m),
      endDay: boundaries[k + 1],
    })),
    rows,
    columnTotals,
    total: columnTotals.reduce((sum, v) => sum + v, 0),
    // Cross-check from the snapshots' own pricing pass: the change in the
    // stored holdings value over the period, minus the same net cash the grid
    // subtracted. Both sides now describe the same quantity, so a gap means the
    // two PRICE histories disagree on those days — not that one of them is
    // including cash the other isn't.
    snapshotGain: months.map((_, k) => {
      const stored = input.snapshots ?? [];
      // Without stored values there is nothing to check against, so the column
      // reads 0 rather than -netInvested, which would look like a finding.
      if (stored.length === 0) return 0;
      const before = holdingsValueOn(stored, previous[k]);
      const after = holdingsValueOn(stored, current[k]);
      return after - before - netInvested[k];
    }),
    unpriced: Array.from(unpricedSet),
    fxFallbacks: fxFallbackKeys.size,
    netInvestedTotal: netInvested.reduce((sum, v) => sum + v, 0),
    baselineDay,
  };
}

/**
 * Column indices whose period END falls inside the range window.
 *
 * Deliberately excludes the "one point before the window" that filterByRange
 * adds for the charts: there, a prior point gives the first segment something
 * to grow from. Here an out-of-range period's contribution is real money, and
 * including it would silently report a gain for a window that didn't contain
 * it.
 */
export function rangeIndices(
  columns: AttributionColumn[],
  range: RangeKey,
  now: Date = new Date()
): number[] {
  const startMs = rangeStartMs(range, now);
  const out: number[] = [];
  for (let i = 0; i < columns.length; i++) {
    if (startMs === null || dayMs(columns[i].endDay) >= startMs) out.push(i);
  }
  // "ALL" and any window older than the history return everything.
  return out.length > 0 ? out : columns.map((_, i) => i);
}

/** Narrow a matrix to a set of columns (as returned by rangeIndices). */
export function selectColumns(matrix: AttributionMatrix, indices: number[]): AttributionMatrix {
  const columns = indices.map((i) => matrix.columns[i]);
  const rows = matrix.rows.map((r) => {
    const values = indices.map((i) => r.values[i] ?? 0);
    return { ...r, values, total: values.reduce((sum, v) => sum + v, 0) };
  });
  const columnTotals = indices.map((_, c) => rows.reduce((sum, r) => sum + r.values[c], 0));
  return {
    ...matrix,
    columns,
    rows,
    columnTotals,
    total: columnTotals.reduce((sum, v) => sum + v, 0),
    snapshotGain: indices.map((i) => matrix.snapshotGain[i] ?? 0),
  };
}

export interface QuarterColumn extends AttributionColumn {
  /** The month keys folded into this column, oldest first. */
  months: string[];
}

/**
 * Fold monthly columns into calendar quarters, summing each row's values.
 *
 * Calendar quarters (Jan–Mar, …) rather than rolling three-month windows,
 * because the question being asked is "how did Q2 go", and a rolling window
 * has no answer to that.
 */
export function groupByQuarter(matrix: AttributionMatrix): AttributionMatrix {
  const groups: QuarterColumn[] = [];
  const indexOfGroup = new Map<string, number>();

  matrix.columns.forEach((column) => {
    const [year, month] = column.key.split("-").map(Number);
    const quarter = Math.floor((month - 1) / 3) + 1;
    const key = `${year}-Q${quarter}`;
    let at = indexOfGroup.get(key);
    if (at === undefined) {
      at = groups.length;
      indexOfGroup.set(key, at);
      groups.push({
        key,
        label: `Q${quarter} ${String(year).slice(-2)}`,
        endDay: column.endDay, // overwritten below with the last month's end
        months: [],
      });
    }
    groups[at].endDay = column.endDay;
    groups[at].months.push(column.key);
  });

  // Column key -> index into the source matrix, resolved once rather than per
  // (row × group × month) inside the sums below.
  const columnIndex = new Map(matrix.columns.map((c, i) => [c.key, i]));
  const monthIndices = groups.map((g) =>
    g.months.map((m) => columnIndex.get(m)).filter((i): i is number => i !== undefined)
  );

  const rows = matrix.rows.map((r) => {
    const values = monthIndices.map((indices) =>
      indices.reduce((sum, i) => sum + (r.values[i] ?? 0), 0)
    );
    return { ...r, values, total: values.reduce((sum, v) => sum + v, 0) };
  });

  const columnTotals = groups.map((_, c) => rows.reduce((sum, r) => sum + r.values[c], 0));
  const snapshotGain = monthIndices.map((indices) =>
    indices.reduce((sum, i) => sum + (matrix.snapshotGain[i] ?? 0), 0)
  );

  return {
    ...matrix,
    columns: groups,
    rows,
    columnTotals,
    total: columnTotals.reduce((sum, v) => sum + v, 0),
    snapshotGain,
  };
}
