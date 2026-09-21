import { describe, it, expect } from "vitest";
import {
  annualizeReturn,
  drawdownSeries,
  filterByRange,
  timeWeightedReturn,
  yearlyReturns,
  type PerfPoint,
} from "@/lib/performance";
import { maxDrawdown } from "@/lib/snapshots";

function p(date: string, totalValueSgd: number, costBasisSgd: number): PerfPoint {
  return { date, totalValueSgd, costBasisSgd };
}

describe("timeWeightedReturn", () => {
  it("equals the simple return for a single lump sum with no later flows", () => {
    const points = [p("2024-01-01", 1000, 1000), p("2025-01-01", 1100, 1000)];
    expect(timeWeightedReturn(points)).toBeCloseTo(0.1, 10);
  });

  it("does NOT count a contribution as growth", () => {
    // Value doubles only because more money was added — TWR must be 0%.
    const points = [p("2024-01-01", 1000, 1000), p("2024-06-01", 2000, 2000)];
    expect(timeWeightedReturn(points)).toBeCloseTo(0, 10);
  });

  it("separates genuine growth from contribution timing", () => {
    // 100 invested, grows 10%, then 1000 more added, then no further growth.
    // Money-weighted intuition would look terrible; TWR should be +10%.
    const points = [
      p("2024-01-01", 1000, 1000),
      p("2024-06-01", 1100, 1000),
      p("2024-06-02", 2100, 2000),
      p("2024-12-01", 2100, 2000),
    ];
    expect(timeWeightedReturn(points)).toBeCloseTo(0.1, 10);
  });

  it("chains multiple periods multiplicatively", () => {
    const points = [
      p("2024-01-01", 1000, 1000),
      p("2024-02-01", 1100, 1000), // +10%
      p("2024-03-01", 1210, 1000), // +10%
    ];
    expect(timeWeightedReturn(points)).toBeCloseTo(0.21, 10);
  });

  it("returns null with fewer than two points", () => {
    expect(timeWeightedReturn([])).toBeNull();
    expect(timeWeightedReturn([p("2024-01-01", 1000, 1000)])).toBeNull();
  });

  it("skips zero-value baselines rather than dividing by zero", () => {
    const points = [p("2024-01-01", 0, 0), p("2024-02-01", 1000, 1000), p("2024-03-01", 1100, 1000)];
    const twr = timeWeightedReturn(points);
    expect(twr).not.toBeNull();
    expect(Number.isFinite(twr!)).toBe(true);
    // Only the second segment counts: 1000 -> 1100 with no new money.
    expect(twr).toBeCloseTo(0.1, 10);
  });

  it("clamps an impossible single-period loss instead of flipping the sign", () => {
    // Bad snapshot: value goes deeply negative. Must not produce a return
    // worse than -100%, which would flip the compounded result positive.
    const points = [p("2024-01-01", 1000, 1000), p("2024-02-01", -5000, 1000)];
    const twr = timeWeightedReturn(points);
    expect(twr).toBeCloseTo(-1, 10);
  });
});

describe("annualizeReturn", () => {
  it("annualizes a two-year doubling to ~41.4%", () => {
    const r = annualizeReturn(1.0, "2023-01-01", "2025-01-01");
    expect(r).toBeCloseTo(Math.pow(2, 1 / 2.002) - 1, 3);
    expect(r!).toBeGreaterThan(0.4);
    expect(r!).toBeLessThan(0.42);
  });

  it("refuses to annualize spans shorter than a month", () => {
    expect(annualizeReturn(0.05, "2025-01-01", "2025-01-20")).toBeNull();
  });

  it("returns null for a total wipeout rather than a complex number", () => {
    expect(annualizeReturn(-1, "2024-01-01", "2025-01-01")).toBeNull();
  });
});

describe("drawdownSeries", () => {
  it("is zero at new highs and negative below them", () => {
    const series = drawdownSeries([
      p("2024-01-01", 1000, 0),
      p("2024-01-02", 1200, 0),
      p("2024-01-03", 900, 0),
      p("2024-01-04", 1300, 0),
    ]);
    expect(series.map((s) => s.drawdown)).toEqual([0, 0, -0.25, 0]);
  });

  it("agrees exactly with maxDrawdown() — the two must never diverge", () => {
    const points = [
      p("2024-01-01", 1000, 0),
      p("2024-01-02", 1400, 0),
      p("2024-01-03", 900, 0),
      p("2024-01-04", 1100, 0),
      p("2024-01-05", 500, 0),
      p("2024-01-06", 800, 0),
    ];
    const worst = Math.min(...drawdownSeries(points).map((s) => s.drawdown));
    expect(worst).toBeCloseTo(maxDrawdown(points)!, 12);
    expect(worst).toBeCloseTo((500 - 1400) / 1400, 12);
  });

  it("returns nothing for an empty series", () => {
    expect(drawdownSeries([])).toEqual([]);
  });
});

describe("filterByRange", () => {
  const points = [
    p("2023-01-01", 100, 100),
    p("2024-01-01", 200, 150),
    p("2024-06-01", 300, 200),
    p("2025-01-01", 400, 250),
  ];
  const now = new Date("2025-01-15T00:00:00.000Z");

  it("returns everything for ALL", () => {
    expect(filterByRange(points, "ALL", now)).toHaveLength(4);
  });

  it("keeps one prior point as a baseline so the first segment has a start", () => {
    const win = filterByRange(points, "1Y", now);
    // window starts ~2024-01-15 -> first inside is 2024-06-01, plus the
    // preceding point for baseline.
    expect(win[0].date).toBe("2024-01-01");
    expect(win.map((x) => x.date)).toContain("2024-06-01");
  });

  it("starts at Jan 1 for YTD", () => {
    const win = filterByRange(points, "YTD", now);
    expect(win.map((x) => x.date)).toContain("2025-01-01");
    expect(win).toHaveLength(2); // 2024-06-01 baseline + 2025-01-01
  });

  it("falls back to the full series when the window predates all data", () => {
    // 3Y back from 2025-01-15 is 2022-01-15, before the first point.
    expect(filterByRange(points, "3Y", now)).toHaveLength(4);
  });

  it("narrows to the newest points (plus baseline) for a short window", () => {
    // 1M back from 2025-01-15 is 2024-12-16; the newest point is 2025-01-01,
    // and 2024-06-01 rides along as the baseline.
    const win = filterByRange(points, "1M", now);
    expect(win.map((x) => x.date)).toEqual(["2024-06-01", "2025-01-01"]);
  });

  it("handles an empty series", () => {
    expect(filterByRange([], "1Y", now)).toEqual([]);
  });
});

describe("yearlyReturns", () => {
  it("groups by calendar year and reports each year's TWR", () => {
    const points = [
      p("2024-01-01", 1000, 1000),
      p("2024-12-31", 1100, 1000), // +10% in 2024, no new money
      p("2025-01-01", 1100, 1000),
      p("2025-12-31", 1320, 1000), // +20% in 2025
    ];
    const years = yearlyReturns(points);
    expect(years.map((y) => y.year)).toEqual([2024, 2025]);
    expect(years[0].returnPct).toBeCloseTo(0.1, 10);
    expect(years[1].returnPct).toBeCloseTo(0.2, 10);
    expect(years[0].startValue).toBe(1000);
    expect(years[1].endValue).toBe(1320);
    expect(years[1].contributions).toBe(0);
  });

  it("reports contributions made during the year", () => {
    const years = yearlyReturns([p("2025-01-01", 1000, 1000), p("2025-06-01", 1500, 1500)]);
    expect(years[0].contributions).toBe(500);
    // Growth was zero — the increase was entirely new money.
    expect(years[0].returnPct).toBeCloseTo(0, 10);
  });

  it("returns an empty list for no data", () => {
    expect(yearlyReturns([])).toEqual([]);
  });
});
