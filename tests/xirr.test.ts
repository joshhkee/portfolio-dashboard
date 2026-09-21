import { describe, it, expect } from "vitest";
import { xirr } from "@/lib/xirr";

function d(s: string) {
  return new Date(s);
}

describe("xirr", () => {
  it("solves a simple one-year lump sum to the annual return", () => {
    // -1000 on 2024-01-01, worth 1100 on 2025-01-01. 2024 is a leap
    // year (366 days) and the solver uses a 365.25-day year, so the
    // elapsed time is ~1.00205 years and the solved rate is slightly
    // under 10% — assert against that exact day-count, not a naive 0.1.
    const years = (d("2025-01-01").getTime() - d("2024-01-01").getTime()) / (365.25 * 86400000);
    const expected = Math.pow(1100 / 1000, 1 / years) - 1;
    const rate = xirr([
      { amount: -1000, date: d("2024-01-01") },
      { amount: 1100, date: d("2025-01-01") },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(expected, 9);
  });

  it("solves a loss correctly", () => {
    const years = (d("2025-01-01").getTime() - d("2024-01-01").getTime()) / (365.25 * 86400000);
    const expected = Math.pow(800 / 1000, 1 / years) - 1;
    const rate = xirr([
      { amount: -1000, date: d("2024-01-01") },
      { amount: 800, date: d("2025-01-01") },
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(expected, 9);
  });

  it("accounts for the timing of irregular contributions", () => {
    // 1000 a full year before the end, 1000 only at the very end.
    // Value 2200. A naive CAGR would say (2200/2000 - 1) = ~10%/yr-ish;
    // XIRR must weight the early money much more heavily.
    const rate = xirr([
      { amount: -1000, date: d("2023-01-01") },
      { amount: -1000, date: d("2024-01-01") },
      { amount: 2200, date: d("2024-01-02") },
    ]);
    expect(rate).not.toBeNull();
    // Solve manually: 1000*(1+r) + 1000 ≈ 2200 at t≈1.0 -> r ≈ 0.2 (approx,
    // exact depends on day-count; assert it's well above the naive 5% CAGR
    // over the 1-year span and near 20%).
    expect(rate!).toBeGreaterThan(0.15);
    expect(rate!).toBeLessThan(0.25);
  });

  it("returns null with fewer than two cashflows", () => {
    expect(xirr([{ amount: -1000, date: d("2024-01-01") }])).toBeNull();
  });

  it("returns null when all cashflows share one date", () => {
    expect(
      xirr([
        { amount: -1000, date: d("2024-01-01") },
        { amount: 1100, date: d("2024-01-01") },
      ])
    ).toBeNull();
  });

  it("handles a zero-value ending (total loss) with a finite result or null, never NaN/throw", () => {
    const rate = xirr([
      { amount: -1000, date: d("2024-01-01") },
      { amount: 0, date: d("2025-01-01") },
    ]);
    expect(rate === null || Number.isFinite(rate)).toBe(true);
  });

  it("returns a finite plausible rate for a realistic multi-contribution history", () => {
    const rate = xirr([
      { amount: -5000, date: d("2023-01-01") },
      { amount: -5000, date: d("2023-07-01") },
      { amount: -5000, date: d("2024-01-01") },
      { amount: -5000, date: d("2024-07-01") },
      { amount: 23000, date: d("2025-01-01") },
    ]);
    expect(rate).not.toBeNull();
    expect(Number.isFinite(rate!)).toBe(true);
    expect(Math.abs(rate!)).toBeLessThan(10);
  });
});
