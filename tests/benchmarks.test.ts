import { describe, it, expect } from "vitest";
import {
  alignCloses,
  alphaBeta,
  benchmarkDailyReturns,
  growthIndex,
  portfolioDailyReturns,
  rebaseTo100,
} from "@/lib/benchmarks";
import type { PerfPoint } from "@/lib/performance";

function point(date: string, totalValueSgd: number, costBasisSgd: number): PerfPoint {
  return { date, totalValueSgd, costBasisSgd };
}

describe("alignCloses", () => {
  it("carries the last close forward across non-trading days", () => {
    // Fri close 100, then a weekend, then Mon close 110. Snapshot rows exist
    // for every calendar day, so Sat/Sun must reuse Friday's close.
    const closes = {
      "2026-01-02": 100, // Friday
      "2026-01-05": 110, // Monday
    };
    const dates = ["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
    expect(alignCloses(dates, closes)).toEqual([100, 100, 100, 110]);
  });

  it("returns null before the benchmark has any data rather than back-filling", () => {
    const closes = { "2026-01-05": 110 };
    expect(alignCloses(["2026-01-02", "2026-01-05"], closes)).toEqual([null, 110]);
  });

  it("returns all nulls when the fetch came back empty", () => {
    expect(alignCloses(["2026-01-02"], {})).toEqual([null]);
  });

  it("matches the number of requested dates", () => {
    const dates = ["2026-01-02", "2026-01-03", "2026-01-04"];
    expect(alignCloses(dates, { "2026-01-02": 5 })).toHaveLength(dates.length);
  });
});

describe("rebaseTo100", () => {
  it("scales the first usable value to exactly 100", () => {
    expect(rebaseTo100([50, 75, 100])).toEqual([100, 150, 200]);
  });

  it("skips leading nulls when choosing the base", () => {
    expect(rebaseTo100([null, 20, 30])).toEqual([null, 100, 150]);
  });

  it("returns all nulls when nothing is usable", () => {
    expect(rebaseTo100([null, null])).toEqual([null, null]);
    expect(rebaseTo100([0, 0])).toEqual([null, null]);
  });
});

describe("growthIndex", () => {
  it("starts at 100", () => {
    expect(growthIndex([point("2026-01-01", 1000, 1000)])).toEqual([100]);
  });

  it("does NOT register a contribution as growth", () => {
    // Value rises 100 -> 150 but 50 of that was new money deposited the same
    // day, so the money already invested did not grow at all.
    const points = [point("2026-01-01", 100, 100), point("2026-01-02", 150, 150)];
    expect(growthIndex(points)).toEqual([100, 100]);
  });

  it("compounds genuine growth", () => {
    // No new money: +10% then +10% compounds to 21%, not 20%.
    const points = [
      point("2026-01-01", 100, 100),
      point("2026-01-02", 110, 100),
      point("2026-01-03", 121, 100),
    ];
    const index = growthIndex(points);
    expect(index[0]).toBe(100);
    expect(index[1]).toBeCloseTo(110, 6);
    expect(index[2]).toBeCloseTo(121, 6);
  });

  it("carries the index through a day it cannot compute", () => {
    const points = [
      point("2026-01-01", 0, 100), // unusable base
      point("2026-01-02", 50, 100),
    ];
    expect(growthIndex(points)).toEqual([100, 100]);
  });
});

describe("benchmarkDailyReturns", () => {
  it("returns zero for a carried-forward (market closed) day", () => {
    const returns = benchmarkDailyReturns([100, 100, 110]);
    expect(returns[0]).toBe(0);
    // Compared approximately on purpose: 110/100 - 1 is 0.10000000000000009,
    // so exact equality here would be testing IEEE 754, not the function.
    expect(returns[1]).toBeCloseTo(0.1, 9);
  });

  it("marks unusable pairs as NaN so the regression can drop them", () => {
    const returns = benchmarkDailyReturns([null, 100, null]);
    expect(returns).toHaveLength(2);
    expect(Number.isNaN(returns[0])).toBe(true);
    expect(Number.isNaN(returns[1])).toBe(true);
  });
});

describe("portfolioDailyReturns", () => {
  it("removes new money so a deposit is not a return", () => {
    const points = [point("2026-01-01", 100, 100), point("2026-01-02", 150, 150)];
    expect(portfolioDailyReturns(points)).toEqual([0]);
  });
});

describe("alphaBeta", () => {
  it("recovers a known beta of 2 with no alpha", () => {
    // Portfolio moves exactly twice the benchmark each day.
    const bench = [0.01, -0.005, 0.002, 0.004, -0.003, 0.006];
    const port = bench.map((b) => b * 2);
    const result = alphaBeta(port, bench);
    expect(result).not.toBeNull();
    expect(result!.beta).toBeCloseTo(2, 6);
    expect(result!.alphaAnnual).toBeCloseTo(0, 6);
    expect(result!.r2).toBeCloseTo(1, 6);
    expect(result!.n).toBe(bench.length);
  });

  it("recovers a constant daily excess return as annualized alpha", () => {
    // Same benchmark, portfolio earns 0.1%/day more with the same beta.
    const bench = [0.01, -0.005, 0.002, 0.004, -0.003, 0.006];
    const port = bench.map((b) => b + 0.001);
    const result = alphaBeta(port, bench);
    expect(result!.beta).toBeCloseTo(1, 6);
    // Arithmetic annualization: daily alpha × 252.
    expect(result!.alphaAnnual).toBeCloseTo(0.001 * 252, 6);
  });

  it("returns null when the benchmark has no variance", () => {
    const bench = [0.002, 0.002, 0.002, 0.002, 0.002, 0.002];
    const port = [0.01, -0.01, 0.02, 0.005, -0.004, 0.001];
    expect(alphaBeta(port, bench)).toBeNull();
  });

  it("returns null below the minimum number of observations", () => {
    expect(alphaBeta([0.01, 0.02, 0.03], [0.01, 0.02, 0.03])).toBeNull();
  });

  it("drops unusable days pairwise instead of discarding the window", () => {
    const bench = [0.01, NaN, 0.002, 0.004, -0.003, 0.006];
    const port = [0.02, 0.05, 0.004, 0.008, -0.006, 0.012];
    const result = alphaBeta(port, bench);
    expect(result).not.toBeNull();
    expect(result!.n).toBe(5); // the NaN day is excluded, the rest survive
    expect(result!.beta).toBeCloseTo(2, 6);
  });

  it("only pairs indices present in both series", () => {
    const result = alphaBeta([0.01, 0.02, 0.03, 0.04], [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]);
    // min() of the two lengths is used, so only 4 pairs exist — under the
    // minimum, hence null rather than a fit on mismatched arrays.
    expect(result).toBeNull();
  });
});
