import { describe, it, expect } from "vitest";
import {
  annualizedVolatility,
  concentration,
  concentrationBand,
  correlationMatrix,
  largestMove,
  rollingAnnualizedReturn,
  sharpeRatio,
  RISK_FREE_RATE,
} from "@/lib/risk";
import type { HistoricalCloses } from "@/lib/prices";
import type { PerfPoint } from "@/lib/performance";

/**
 * Value and cost basis are separate on purpose: defaulting cost basis to the
 * value would mean every day's gain counted as new money, which is exactly the
 * bug the contribution-stripping formula exists to avoid.
 */
function point(date: string, totalValueSgd: number, costBasisSgd = 100): PerfPoint {
  return { date, totalValueSgd, costBasisSgd };
}

/** Consecutive calendar dates, enough to clear the correlation sample gate. */
function days(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
  );
}

function series(values: number[], dates: string[] = days(values.length)): HistoricalCloses {
  return Object.fromEntries(dates.slice(0, values.length).map((d, i) => [d, values[i]]));
}

describe("concentration", () => {
  it("reports equal weights as an effective count of N", () => {
    const result = concentration([25, 25, 25, 25]);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(4);
    expect(result!.largestWeight).toBeCloseTo(0.25, 12);
    expect(result!.hhi).toBeCloseTo(0.25, 12);
    expect(result!.effectiveN).toBeCloseTo(4, 12);
    expect(result!.band).toBe("high");
  });

  it("separates one dominant holding from many small ones", () => {
    // 90% in one name behaves like roughly one position, however many others
    // sit beside it.
    const lopsided = concentration([900, 25, 25, 25, 25]);
    expect(lopsided!.effectiveN).toBeLessThan(1.3);
    expect(lopsided!.top5Weight).toBeCloseTo(1, 12);

    // Ten equal names behave like ten.
    const spread = concentration(Array.from({ length: 10 }, () => 100));
    expect(spread!.effectiveN).toBeCloseTo(10, 12);
    expect(spread!.band).toBe("low");
  });

  it("ignores zero-value rows instead of counting them as holdings", () => {
    const result = concentration([100, 100, 0, 0]);
    expect(result!.count).toBe(2);
    expect(result!.hhi).toBeCloseTo(0.5, 12);
  });

  it("returns null when there is nothing to measure", () => {
    expect(concentration([])).toBeNull();
    expect(concentration([0, 0])).toBeNull();
    expect(concentration([-5, 0])).toBeNull();
  });

  it("bands the HHI at the conventional cut-offs", () => {
    expect(concentrationBand(0.1)).toBe("low");
    expect(concentrationBand(0.15)).toBe("moderate");
    expect(concentrationBand(0.249)).toBe("moderate");
    expect(concentrationBand(0.25)).toBe("high");
  });
});

describe("annualizedVolatility", () => {
  it("is zero for a flat series", () => {
    expect(annualizedVolatility([0, 0, 0, 0])).toBe(0);
  });

  it("annualizes on the calendar-day basis, undoing the weekend zeros", () => {
    const returns = [0.01, -0.01, 0.01, -0.01];
    // Sample (n−1) estimator: an alternating ±1% series has stdev
    // 0.01·sqrt(n/(n−1)), not 0.01.
    const sampleStdev = 0.01 * Math.sqrt(returns.length / (returns.length - 1));

    expect(annualizedVolatility(returns)).toBeCloseTo(sampleStdev * Math.sqrt(365), 10);

    // The basis stays parameterized for trading-day callers.
    expect(annualizedVolatility(returns, 252)).toBeCloseTo(sampleStdev * Math.sqrt(252), 10);
  });

  it("drops unusable days rather than propagating NaN", () => {
    const withGaps = annualizedVolatility([NaN, 0.01, NaN, -0.01, NaN]);
    expect(withGaps).toBeCloseTo(annualizedVolatility([0.01, -0.01])!, 12);
  });

  it("needs at least two observations", () => {
    expect(annualizedVolatility([])).toBeNull();
    expect(annualizedVolatility([0.01])).toBeNull();
    expect(annualizedVolatility([NaN, NaN])).toBeNull();
  });
});

describe("sharpeRatio", () => {
  it("subtracts the risk-free rate before dividing by volatility", () => {
    expect(sharpeRatio(0.135, 0.1, 0.035)).toBeCloseTo(1, 12);
  });

  it("refuses to divide by ~zero volatility", () => {
    expect(sharpeRatio(0.2, 0, 0.035)).toBeNull();
    expect(sharpeRatio(0.2, 0.0005, 0.035)).toBeNull();
  });

  it("returns null for missing inputs and zero at the risk-free rate", () => {
    expect(sharpeRatio(null, 0.1)).toBeNull();
    expect(sharpeRatio(0.1, null)).toBeNull();
    expect(sharpeRatio(RISK_FREE_RATE, 0.1)).toBeCloseTo(0, 12);
  });
});

describe("largestMove", () => {
  it("finds the biggest day and the share of variance it carries", () => {
    const returns = [0.01, -0.01, 0.02, -0.15, 0.01];
    const dates = [
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
      "2026-01-06",
    ];

    const move = largestMove(returns, dates)!;
    expect(move.date).toBe("2026-01-05");
    expect(move.value).toBe(-0.15);
    // One −15% day among ±2% days is most of the variance, which is the whole
    // reason the panel reports it.
    expect(move.varianceShare).toBeGreaterThan(0.7);
  });

  it("keeps the date aligned with the move, not just the magnitude", () => {
    const returns = [0.05, 0.01, -0.02];
    const dates = ["2026-02-01", "2026-02-02", "2026-02-03"];
    expect(largestMove(returns, dates)!.date).toBe("2026-02-01");
  });

  it("returns null when there is nothing to report or dates do not align", () => {
    expect(largestMove([], [])).toBeNull();
    expect(largestMove([NaN, NaN], ["2026-01-01", "2026-01-02"])).toBeNull();
    expect(largestMove([0.01], [])).toBeNull();
  });
});

describe("correlationMatrix", () => {
  it("is +1 when returns move in proportion and −1 when they move in opposition", () => {
    // Correlation is computed on RETURNS, so exact ±1 requires returns that
    // are exactly proportional — building levels from a return sequence is
    // the only way to express that (two linear price ramps are close to, but
    // not, perfectly correlated, because their returns differ day to day).
    const returns = [0.01, -0.005, 0.02, -0.01, 0.015];
    const pattern = Array.from({ length: 5 }, () => returns).flat();
    const fromReturns = (scale: number) => {
      const out = [100];
      for (const r of pattern) out.push(out[out.length - 1] * (1 + scale * r));
      return out;
    };

    const { matrix, keys } = correlationMatrix({
      "US::A": series(fromReturns(1)),
      "US::B": series(fromReturns(-2)),
    });

    expect(keys).toEqual(["US::A", "US::B"]);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(-1, 8);
    expect(matrix[1][0]).toBeCloseTo(-1, 8);
  });

  it("is symmetric and finite for two identical series", () => {
    const values = Array.from({ length: 25 }, (_, i) => 100 * (1 + 0.01 * Math.sin(i)));
    const { matrix } = correlationMatrix({ "US::A": series(values), "US::B": series(values) });
    expect(matrix[0][1]).toBeCloseTo(1, 10);
    expect(matrix[1][0]).toBeCloseTo(1, 10);
  });

  it("needs enough overlapping days before reporting a correlation", () => {
    const short = Array.from({ length: 5 }, (_, i) => 100 + i);
    const { matrix } = correlationMatrix({ "US::A": series(short), "US::B": series(short) });
    expect(matrix[0][1]).toBeNull();
  });

  it("reports null rather than 0 when a series never moves", () => {
    const dates = days(30);
    const moving = dates.map((_, i) => 100 + (i % 5));
    const flat = dates.map(() => 100);

    const { matrix } = correlationMatrix({
      "US::FLAT": series(flat, dates),
      "US::MOVE": series(moving, dates),
    });

    // Zero variance has no correlation — 0 would claim "unrelated", which is
    // a different and wrong statement.
    expect(matrix[0][1]).toBeNull();
  });

  it("aligns on the union of dates, so a market holiday does not disqualify a pair", () => {
    const dates = days(25);
    const a = series(dates.map((_, i) => 100 + i), dates);
    // B skips every third date, as a different market's calendar would.
    const b: HistoricalCloses = {};
    dates.forEach((d, i) => {
      if (i % 3 !== 0) b[d] = 200 + i;
    });

    const { keys, matrix, observations } = correlationMatrix({ "US::A": a, "SG::B": b });

    expect(keys).toEqual(["SG::B", "US::A"]);
    expect(observations).toBe(25);
    expect(typeof matrix[0][1]).toBe("number");
  });

  it("returns an empty matrix when there is nothing to correlate", () => {
    expect(correlationMatrix({}).keys).toEqual([]);
    expect(correlationMatrix({ "US::A": { "2026-01-01": 100 } }).keys).toEqual([]);
  });
});

describe("rollingAnnualizedReturn", () => {
  it("emits nothing until a full window exists, then reports that window", () => {
    const points = [
      point("2025-01-01", 100),
      point("2025-07-01", 110), // 181 days in
      point("2025-12-31", 120), // 364 days in: still short
      point("2026-01-01", 121), // 365 days in: first full year
      point("2026-07-01", 133.1), // 546 days in
    ];

    const out = rollingAnnualizedReturn(points, 365);
    expect(out).toHaveLength(points.length);
    expect(out.slice(0, 3)).toEqual([null, null, null]);

    // 100 → 121 over exactly 365 days is +21%, and the trailing year at the
    // last point happens to be +21% too.
    expect(out[3]).toBeCloseTo(0.21, 3);
    expect(out[4]).toBeCloseTo(0.21, 3);
  });

  it("strips contributions, so a deposit is not growth", () => {
    const points = [
      point("2025-01-01", 100, 100),
      point("2026-01-01", 250, 250), // the whole +150 is new money
    ];
    expect(rollingAnnualizedReturn(points, 365)[1]).toBeCloseTo(0, 10);
  });

  it("handles an empty series", () => {
    expect(rollingAnnualizedReturn([], 365)).toEqual([]);
  });
});
