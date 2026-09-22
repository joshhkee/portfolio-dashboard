import { describe, it, expect } from "vitest";
import { depositSchedule, isScheduledMonthLabel, type ScheduledContribution } from "@/lib/schedule";

function c(label: string, date: string, paidOn: string | null): ScheduledContribution {
  return {
    label,
    date: new Date(`${date}T00:00:00.000Z`),
    paidOn: paidOn === null ? null : new Date(`${paidOn}T00:00:00.000Z`),
  };
}

/** One month's lump: every stakeholder's row shares the label and arrive date. */
function month(label: string, attributed: string, paidOn: string | null): ScheduledContribution[] {
  return [c(label, attributed, paidOn), c(label, attributed, paidOn), c(label, attributed, paidOn)];
}

describe("isScheduledMonthLabel", () => {
  it("recognises a month label", () => {
    expect(isScheduledMonthLabel("MAR (2026)")).toBe(true);
    expect(isScheduledMonthLabel("SEP (2026)")).toBe(true);
  });

  it("treats one-off deposits as having no month to be late against", () => {
    expect(isScheduledMonthLabel("Initial Investment")).toBe(false);
    expect(isScheduledMonthLabel("Additional")).toBe(false);
    // Names a month, but is an addition TO it, not the month's schedule.
    expect(isScheduledMonthLabel("Additional (MAR 2025)")).toBe(false);
  });
});

describe("depositSchedule", () => {
  it("measures lateness from the end of the attributed month", () => {
    const schedule = depositSchedule([
      ...month("MAY (2025)", "2025-05-01", "2025-06-05"), // 5 days after 31 May
      ...month("MAR (2026)", "2026-03-01", "2026-05-14"), // 44 days after 31 Mar
    ]);

    expect(schedule.rows.map((r) => [r.label, r.paidOn, r.daysLate])).toEqual([
      ["MAY (2025)", "2025-06-05", 5],
      ["MAR (2026)", "2026-05-14", 44],
    ]);
  });

  it("counts a payment inside its own month as on time", () => {
    const schedule = depositSchedule(month("SEP (2026)", "2026-09-01", "2026-09-09"));
    expect(schedule.rows[0].daysLate).toBe(0);
    expect(schedule.lateMonths).toBe(0);
  });

  it("never calls an early payment late", () => {
    // November's lump lands in mid-October, ahead of the month it belongs to.
    const schedule = depositSchedule(month("NOV (2025)", "2025-11-01", "2025-10-13"));
    expect(schedule.rows[0].daysLate).toBe(0);
    expect(schedule.lateMonths).toBe(0);
  });

  it("treats an unknown payment date as unmeasured, not as on time", () => {
    const schedule = depositSchedule([
      ...month("AUG (2025)", "2025-08-01", "2025-08-22"),
      ...month("SEP (2025)", "2025-09-01", null),
    ]);

    expect(schedule.measuredMonths).toBe(1);
    expect(schedule.lateMonths).toBe(0);
    expect(schedule.rows.find((r) => r.label === "SEP (2025)")?.paidOn).toBeNull();
  });

  it("completes a month when its LAST row lands, not its first", () => {
    // One stakeholder pays on the 2nd, the rest of the month only arrives in
    // October — the month is not funded until October.
    const schedule = depositSchedule([
      c("JUN (2025)", "2025-06-01", "2025-06-02"),
      c("JUN (2025)", "2025-06-01", "2025-10-04"),
    ]);

    expect(schedule.rows[0].paidOn).toBe("2025-10-04");
    expect(schedule.rows[0].daysLate).toBe(96); // 30 Jun -> 4 Oct
  });

  it("omits one-off deposits from the schedule entirely", () => {
    const schedule = depositSchedule([
      ...month("APR (2025)", "2025-04-01", "2025-04-03"),
      c("Initial Investment", "2025-03-01", "2025-03-01"),
      c("Additional", "2026-05-09", "2026-05-09"),
    ]);

    expect(schedule.rows.map((r) => r.label)).toEqual(["APR (2025)"]);
  });

  it("reports the worst lateness for a single-line summary", () => {
    const schedule = depositSchedule([
      ...month("DEC (2025)", "2025-12-01", "2026-01-29"), // 29 days
      ...month("FEB (2026)", "2026-02-01", "2026-04-08"), // 39 days
      ...month("JUL (2026)", "2026-07-01", "2026-07-08"), // on time
    ]);

    expect(schedule.measuredMonths).toBe(3);
    expect(schedule.lateMonths).toBe(2);
    expect(schedule.worstLate?.label).toBe("FEB (2026)");
    expect(schedule.worstLate?.daysLate).toBe(39);
  });

  it("handles February in a leap year and a December month end", () => {
    // 2028 is a leap year: February ends on the 29th.
    const leap = depositSchedule(month("FEB (2028)", "2028-02-01", "2028-03-01"));
    expect(leap.rows[0].daysLate).toBe(1);

    const yearEnd = depositSchedule(month("DEC (2026)", "2026-12-01", "2027-01-01"));
    expect(yearEnd.rows[0].daysLate).toBe(1);
  });

  it("returns an empty schedule rather than throwing when nothing is recorded", () => {
    const schedule = depositSchedule([]);
    expect(schedule.rows).toEqual([]);
    expect(schedule.measuredMonths).toBe(0);
    expect(schedule.lateMonths).toBe(0);
    expect(schedule.worstLate).toBeNull();
  });
});
