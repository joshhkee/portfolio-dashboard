import { describe, it, expect } from "vitest";
import { splitByStakeholder, stakeholderTimeline, type ContributionLike } from "@/lib/stakeholders";
import type { PerfPoint } from "@/lib/performance";

function contribution(name: string, amount: number, date: string): ContributionLike {
  return { name, amount, date: new Date(`${date}T00:00:00.000Z`) };
}

function point(date: string, totalValueSgd: number, costBasisSgd: number): PerfPoint {
  return { date, totalValueSgd, costBasisSgd };
}

describe("splitByStakeholder", () => {
  const contributions = [
    contribution("Alex", 6000, "2025-01-01"),
    contribution("Bo", 3000, "2025-01-01"),
    contribution("Cy", 1000, "2025-01-01"),
  ];

  it("derives shares pro-rata by contribution", () => {
    const rows = splitByStakeholder(contributions, 12000, new Date("2026-01-01T00:00:00Z"));
    expect(rows.map((r) => r.name)).toEqual(["Alex", "Bo", "Cy"]);
    expect(rows.map((r) => r.share)).toEqual([0.6, 0.3, 0.1]);
  });

  it("gives each stakeholder a slice of the total that sums back to it", () => {
    const total = 13579.42;
    const rows = splitByStakeholder(contributions, total, new Date("2026-01-01T00:00:00Z"));
    const sum = rows.reduce((s, r) => s + r.currentValue, 0);
    expect(sum).toBeCloseTo(total, 6);
  });

  it("orders stakeholders by contribution, largest first", () => {
    const rows = splitByStakeholder(
      [contribution("Small", 100, "2025-01-01"), contribution("Big", 900, "2025-01-01")],
      1000,
      new Date("2026-01-01T00:00:00Z")
    );
    expect(rows.map((r) => r.name)).toEqual(["Big", "Small"]);
  });

  it("recovers a simple annualized return for a single lump sum", () => {
    // 1000 in, 1100 out exactly one year later = 10%.
    const rows = splitByStakeholder(
      [contribution("Solo", 1000, "2025-01-01")],
      1100,
      new Date("2026-01-01T00:00:00Z")
    );
    expect(rows[0].xirr).not.toBeNull();
    expect(rows[0].xirr!).toBeCloseTo(0.1, 3);
  });

  it("gives stakeholders different returns when they contributed at different times", () => {
    // Same amount each, but one paid in a year before the other. With the pot
    // up overall, the earlier contributor's money was invested longer, so their
    // money-weighted return should differ from the later one's.
    const rows = splitByStakeholder(
      [
        contribution("Early", 1000, "2024-01-01"),
        contribution("Late", 1000, "2025-06-01"),
      ],
      2400,
      new Date("2026-01-01T00:00:00Z")
    );
    const early = rows.find((r) => r.name === "Early")!;
    const late = rows.find((r) => r.name === "Late")!;
    expect(early.xirr).not.toBeNull();
    expect(late.xirr).not.toBeNull();
    expect(early.xirr).not.toBeCloseTo(late.xirr!, 4);
  });

  it("returns null XIRR (not a wrong number) when there is nothing to solve", () => {
    const rows = splitByStakeholder(
      [contribution("Zero", 0, "2025-01-01")],
      0,
      new Date("2025-01-01T00:00:00Z")
    );
    // Every cashflow on the same date: no rate exists.
    expect(rows[0].xirr).toBeNull();
  });

  it("handles an empty ledger without dividing by zero", () => {
    expect(splitByStakeholder([], 5000, new Date())).toEqual([]);
  });
});

describe("stakeholderTimeline", () => {
  const contributions = [
    contribution("Alex", 600, "2025-01-01"),
    contribution("Bo", 400, "2025-03-01"),
  ];

  it("sums to each day's portfolio total", () => {
    const snapshots = [
      point("2025-01-02", 1050, 600),
      point("2025-03-02", 1200, 1000),
      point("2025-04-01", 1500, 1000),
    ];
    const timeline = stakeholderTimeline(contributions, snapshots);
    expect(timeline).toHaveLength(snapshots.length);
    timeline.forEach((t, i) => {
      const sum = Object.values(t.value).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(snapshots[i].totalValueSgd, 6);
    });
  });

  it("does not show money before it was contributed", () => {
    const snapshots = [
      point("2025-01-02", 1050, 600), // Bo hasn't paid in yet
      point("2025-03-02", 1200, 1000),
    ];
    const timeline = stakeholderTimeline(contributions, snapshots);
    expect(timeline[0].contributed["Bo"]).toBe(0);
    expect(timeline[0].value["Bo"]).toBe(0);
    expect(timeline[0].contributed["Alex"]).toBe(600);
    // Alex owns the whole pot that day.
    expect(timeline[0].value["Alex"]).toBeCloseTo(1050, 6);
    expect(timeline[1].contributed["Bo"]).toBe(400);
  });

  it("counts a contribution dated on the snapshot day itself", () => {
    const timeline = stakeholderTimeline(
      [contribution("Alex", 100, "2025-01-01")],
      [point("2025-01-01", 100, 100)]
    );
    expect(timeline[0].contributed["Alex"]).toBe(100);
  });

  it("returns zero values rather than Infinity when a day has no outlay", () => {
    const timeline = stakeholderTimeline(contributions, [point("2025-01-02", 100, 0)]);
    expect(timeline[0].value["Alex"]).toBe(0);
  });

  it("emits no points when there are no snapshots", () => {
    expect(stakeholderTimeline(contributions, [])).toEqual([]);
  });
});
