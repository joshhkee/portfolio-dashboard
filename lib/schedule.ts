// Deposit-schedule timing — "are we up to schedule?".
//
// A contribution carries two dates and they answer different questions.
// `date` is the month the deposit is ATTRIBUTED to (always that month's first
// day), which is what makes the outlay pivot read as a clean month-by-month
// schedule. `paidOn` is when the money actually arrived. Keeping them apart is
// the whole point: before `paidOn` existed, a month funded two months late was
// indistinguishable from one paid on the first — and "we are behind on
// deposits" is a statement about arrival, not attribution.
//
// Late means the money landed after the attributed month had closed. Paying
// EARLY is never late (a lump covering November in mid-October is on time),
// and an unknown payment date is not late either — it is unknown, which is why
// `measuredMonths` is counted separately from the total.
//
// Pure: no I/O and no clock, so this definition has exactly one implementation
// and can be tested against calendar arithmetic.

export const DAY_MS = 86_400_000;

export interface ScheduledContribution {
  label: string;
  /** Attributed month — the first of that month. */
  date: Date;
  /** Arrival date, or null when it was never recorded. */
  paidOn: Date | null;
}

export interface DepositTimingRow {
  label: string;
  /** Attributed month, "YYYY-MM". */
  month: string;
  /** The LAST arrival recorded under this label, "YYYY-MM-DD"; null when unknown. */
  paidOn: string | null;
  /** Whole days between the end of the attributed month and arrival; 0 when on time or unknown. */
  daysLate: number;
}

export interface DepositSchedule {
  /** One row per scheduled month, oldest first. Non-month labels are omitted. */
  rows: DepositTimingRow[];
  /** Scheduled months with a known arrival date — what `lateMonths` is out of. */
  measuredMonths: number;
  lateMonths: number;
  /** The worst offender, for a one-line summary. Null when nothing was late. */
  worstLate: DepositTimingRow | null;
}

/**
 * "MAR (2026)" is a scheduled month; "Initial Investment", "Additional" and
 * "Additional (MAR 2025)" are one-off deposits with no month to be late
 * against, so they never carry a schedule verdict.
 */
export function isScheduledMonthLabel(label: string): boolean {
  return /^[A-Za-z]{3,9}\s*\(\s*\d{4}\s*\)\s*$/.test(label);
}

/** UTC midnight of the first day of the month AFTER the one `d` falls in. */
function nextMonthStartUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** UTC midnight of the last day of the month `d` falls in. */
function monthEndUtc(d: Date): number {
  return nextMonthStartUtc(d) - DAY_MS;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Timing verdict per attributed month.
 *
 * A month's money usually arrives as one lump split across several stakeholder
 * rows, so a label is complete when its LAST row lands — the max `paidOn`
 * across the label, not the first.
 */
export function depositSchedule(rows: ScheduledContribution[]): DepositSchedule {
  const byLabel = new Map<string, { date: Date; paidOn: number | null }>();

  for (const row of rows) {
    if (!isScheduledMonthLabel(row.label)) continue;
    const paid = row.paidOn ? row.paidOn.getTime() : null;
    const existing = byLabel.get(row.label);
    if (!existing) {
      byLabel.set(row.label, { date: row.date, paidOn: paid });
      continue;
    }
    if (row.date.getTime() < existing.date.getTime()) existing.date = row.date;
    if (paid !== null && (existing.paidOn === null || paid > existing.paidOn)) {
      existing.paidOn = paid;
    }
  }

  const out: DepositTimingRow[] = Array.from(byLabel.entries())
    .map(([label, g]) => ({
      label,
      month: g.date.toISOString().slice(0, 7),
      paidOn: g.paidOn === null ? null : isoDay(g.paidOn),
      // Both ends are UTC midnights, so this is an exact whole number of days.
      daysLate:
        g.paidOn === null ? 0 : Math.max(0, Math.round((g.paidOn - monthEndUtc(g.date)) / DAY_MS)),
    }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  const measured = out.filter((r) => r.paidOn !== null);
  const late = measured.filter((r) => r.daysLate > 0);
  const worstLate = late.reduce<DepositTimingRow | null>(
    (worst, r) => (worst === null || r.daysLate > worst.daysLate ? r : worst),
    null
  );

  return { rows: out, measuredMonths: measured.length, lateMonths: late.length, worstLate };
}
