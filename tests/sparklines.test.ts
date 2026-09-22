import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  MAX_SPARKLINE_KEYS,
  parseSparklineKeys,
  toSparklinePoints,
  trendOf,
} from "@/lib/sparklines";
import { priceKey } from "@/lib/prices";

describe("parseSparklineKeys", () => {
  it("parses the canonical priceKey form the API itself returns", () => {
    // The regression: this used to split on a single colon, so "US::VOO" became
    // region "US" and ticker "", the pair was dropped, and the endpoint
    // answered {series:{}} — which is why the dashboard's position rows showed
    // a dash instead of a trend while the positions table worked.
    expect(parseSparklineKeys("US::VOO")).toEqual([{ region: "US", ticker: "VOO" }]);
    expect(parseSparklineKeys(priceKey("SG", "D05"))).toEqual([{ region: "SG", ticker: "D05" }]);
  });

  it("still parses the older single-colon form", () => {
    expect(parseSparklineKeys("US:VOO,SG:D05")).toEqual([
      { region: "US", ticker: "VOO" },
      { region: "SG", ticker: "D05" },
    ]);
  });

  it("parses a mixed list, so one caller cannot break another's keys", () => {
    expect(parseSparklineKeys("US::VOO,SG:D05,HK::0700")).toEqual([
      { region: "US", ticker: "VOO" },
      { region: "SG", ticker: "D05" },
      { region: "HK", ticker: "0700" },
    ]);
  });

  it("drops anything without both halves rather than fetching a blank symbol", () => {
    expect(parseSparklineKeys("")).toEqual([]);
    expect(parseSparklineKeys("US::")).toEqual([]);
    expect(parseSparklineKeys(":VOO")).toEqual([]);
    expect(parseSparklineKeys("US::VOO,,SG::D05")).toHaveLength(2);
    expect(parseSparklineKeys("nonsense")).toEqual([]);
  });

  it("trims stray whitespace", () => {
    expect(parseSparklineKeys(" US :: VOO ")).toEqual([{ region: "US", ticker: "VOO" }]);
  });

  it("caps the list so one query cannot ask for thousands", () => {
    const raw = Array.from({ length: MAX_SPARKLINE_KEYS + 25 }, (_, i) => `US::T${i}`).join(",");
    expect(parseSparklineKeys(raw)).toHaveLength(MAX_SPARKLINE_KEYS);
    expect(parseSparklineKeys("US::VOO,SG::D05", 1)).toEqual([{ region: "US", ticker: "VOO" }]);
  });
});

describe("trendOf", () => {
  it("reports an upward move", () => {
    const trend = trendOf([100, 103.2])!;
    expect(trend.direction).toBe("up");
    expect(trend.changePct).toBeCloseTo(0.032, 6);
  });

  it("reports a downward move", () => {
    const trend = trendOf([100, 95])!;
    expect(trend.direction).toBe("down");
    expect(trend.changePct).toBeCloseTo(-0.05, 6);
  });

  it("treats an unchanged series as flat", () => {
    expect(trendOf([100, 100, 100])!.direction).toBe("flat");
  });

  it("returns null when there is no trend to show", () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf([100])).toBeNull();
  });

  it("does not divide by zero when the series starts at zero", () => {
    const trend = trendOf([0, 5])!;
    expect(trend.changePct).toBe(0);
    expect(Number.isFinite(trend.changePct)).toBe(true);
  });
});

describe("toSparklinePoints", () => {
  it("emits one x,y pair per value", () => {
    const points = toSparklinePoints([1, 2, 3], 100, 20);
    expect(points.split(" ")).toHaveLength(3);
    points.split(" ").forEach((pair) => {
      expect(pair).toMatch(/^\d+\.\d{2},\d+\.\d{2}$/);
    });
  });

  it("spans the full width from first to last", () => {
    const pairs = toSparklinePoints([1, 5, 9], 100, 20).split(" ");
    expect(pairs[0].split(",")[0]).toBe("0.00");
    expect(pairs[2].split(",")[0]).toBe("100.00");
  });

  it("puts the maximum at the top of the box and the minimum at the bottom", () => {
    const pairs = toSparklinePoints([10, 20], 100, 20).split(" ");
    const firstY = Number(pairs[0].split(",")[1]);
    const lastY = Number(pairs[1].split(",")[1]);
    // Screen coordinates: smaller y is higher.
    expect(firstY).toBeGreaterThan(lastY);
    expect(firstY).toBeCloseTo(19, 2);
    expect(lastY).toBeCloseTo(1, 2);
  });

  it("draws a flat series down the middle instead of collapsing it", () => {
    const pairs = toSparklinePoints([7, 7, 7], 100, 20).split(" ");
    for (const pair of pairs) {
      expect(Number(pair.split(",")[1])).toBeCloseTo(10, 2);
    }
  });

  it("returns an empty string when a line cannot be drawn", () => {
    expect(toSparklinePoints([], 100, 20)).toBe("");
    expect(toSparklinePoints([42], 100, 20)).toBe("");
  });

  it("keeps every point inside the box", () => {
    const points = toSparklinePoints([3, 99, 12, 47, 60], 64, 20);
    for (const pair of points.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(64);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(20);
    }
  });
});

describe("mapWithConcurrency", () => {
  it("returns results in input order regardless of completion order", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1); // actually ran in parallel, not serially
  });

  it("handles an empty input without hanging", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
