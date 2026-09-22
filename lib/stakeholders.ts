// Per-stakeholder performance.
//
// The portfolio is pooled: five people contribute into one pot and buy the
// same instruments. Until now the only stakeholder-level number was "% of
// outlay", which answers "who paid in most" but not "how is each person's
// money doing".
//
// Two deliberate design choices:
//
//  1. Ownership is pro-rata by CONTRIBUTION, not by a stored balance. The
//     ledger is the only source of truth (see the invariants in
//     docs/PLAN.md), so a stakeholder's share is derived from what they put
//     in — never stored, never hand-entered.
//  2. Each stakeholder's XIRR reuses lib/xirr.ts. A second solver would be a
//     second thing to get wrong, and it would drift from the headline XIRR
//     the home page shows.
//
// Everything here is PURE: no DB, no network, so it is all unit-testable.

import { xirr } from "@/lib/xirr";
import type { PerfPoint } from "@/lib/performance";

export interface ContributionLike {
  /** Stakeholder name, as it appears on Contributor.name. */
  name: string;
  /** Amount in the portfolio's base currency (SGD). */
  amount: number;
  date: Date;
}

export interface StakeholderRow {
  name: string;
  contributed: number;
  /** Fraction of total outlay, 0..1. */
  share: number;
  /**
   * Their slice of the current portfolio value, i.e. share × total. This is
   * the pro-rata claim on the pot, which is the only sense in which a pooled
   * portfolio has per-person values.
   */
  currentValue: number;
  /** Money-weighted return for this stakeholder alone. */
  xirr: number | null;
}

/**
 * Split the current portfolio value between stakeholders by contribution
 * share, and compute each one's own money-weighted return.
 *
 * `totalValue` must be the SAME total the overview page shows (holdings +
 * cash, in SGD) — otherwise the shares won't reconcile with the headline
 * number, which is the whole point of showing them side by side.
 *
 * Ordered by contribution, largest first, matching how the outlay page
 * already lists stakeholders.
 */
export function splitByStakeholder(
  contributions: ContributionLike[],
  totalValue: number,
  asOf: Date = new Date()
): StakeholderRow[] {
  const totals = new Map<string, number>();
  for (const c of contributions) {
    totals.set(c.name, (totals.get(c.name) ?? 0) + c.amount);
  }
  const grandTotal = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);

  return Array.from(totals.entries())
    .map(([name, contributed]) => {
      const share = grandTotal === 0 ? 0 : contributed / grandTotal;
      const currentValue = totalValue * share;

      // Same shape the overview builds: each contribution as money in on its
      // real date, then one positive cashflow for the current value today.
      const flows = contributions
        .filter((c) => c.name === name)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((c) => ({ amount: -c.amount, date: c.date }));
      if (flows.length > 0) flows.push({ amount: currentValue, date: asOf });

      return {
        name,
        contributed,
        share,
        currentValue,
        xirr: xirr(flows),
      };
    })
    .sort((a, b) => b.contributed - a.contributed);
}

export interface StakeholderTimelinePoint {
  date: string;
  /** Cumulative contributed per stakeholder, as of this date. */
  contributed: Record<string, number>;
  /** Their pro-rata slice of that day's portfolio value. */
  value: Record<string, number>;
}

/**
 * Contribution-vs-value over time, per stakeholder.
 *
 * The denominator is the SNAPSHOT's own `costBasisSgd` rather than a
 * recomputed outlay total, which makes the series self-reconciling: the
 * per-stakeholder values on any given day add up to exactly that day's
 * `totalValueSgd`, by construction. It also means a day with no snapshot is
 * simply absent instead of being interpolated into existence.
 *
 * Contributions dated after a snapshot's day are ignored until the first
 * snapshot on or after them, so the timeline can't show money that hadn't
 * arrived yet.
 */
export function stakeholderTimeline(
  contributions: ContributionLike[],
  snapshots: PerfPoint[]
): StakeholderTimelinePoint[] {
  const names = Array.from(new Set(contributions.map((c) => c.name)));
  const sorted = [...contributions].sort((a, b) => a.date.getTime() - b.date.getTime());

  const cumulative = new Map<string, number>(names.map((n) => [n, 0]));
  let cursor = 0;
  const out: StakeholderTimelinePoint[] = [];

  for (const snap of snapshots) {
    // End of the snapshot's UTC day: a contribution made that day counts
    // toward that day, matching how the snapshot's own cost basis is built.
    const cutoff = new Date(`${snap.date}T23:59:59.999Z`).getTime();
    while (cursor < sorted.length && sorted[cursor].date.getTime() <= cutoff) {
      const c = sorted[cursor];
      cumulative.set(c.name, (cumulative.get(c.name) ?? 0) + c.amount);
      cursor++;
    }

    const contributed: Record<string, number> = {};
    const value: Record<string, number> = {};
    for (const n of names) {
      const cum = cumulative.get(n) ?? 0;
      contributed[n] = cum;
      value[n] =
        snap.costBasisSgd > 0 ? snap.totalValueSgd * (cum / snap.costBasisSgd) : 0;
    }
    out.push({ date: snap.date, contributed, value });
  }

  return out;
}
