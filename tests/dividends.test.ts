import { describe, expect, it } from "vitest";
import {
  dividendMonthlyHistory,
  dividendPositionMetrics,
  parseDividendDate,
  positionKey,
  trailingDividendIncome,
  type DividendRecord,
} from "@/lib/dividends";

const asOf = new Date("2026-10-06T00:00:00.000Z");

function record(
  date: string,
  region: string,
  ticker: string,
  amount: number,
  amountSgd: number,
  withholding = 0
): DividendRecord {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    region,
    ticker,
    amount,
    amountSgd,
    currency: region === "US" ? "USD" : region === "HK" ? "HKD" : "SGD",
    withholding,
  };
}

describe("parseDividendDate", () => {
  it("accepts only real UTC calendar dates rather than silently rolling invalid days", () => {
    expect(parseDividendDate("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(parseDividendDate("2026-02-30")).toBeNull();
    expect(parseDividendDate("2026-2-03")).toBeNull();
    expect(parseDividendDate(null)).toBeNull();
  });
});

describe("trailingDividendIncome", () => {
  it("sums net SGD receipts over the trailing 12 months including both calendar boundaries", () => {
    const result = trailingDividendIncome(
      [
        record("2025-10-06", "US", "VOO", 8, 10, 2),
        record("2026-01-01", "SG", "D05", 12, 12),
        record("2026-10-07", "US", "VOO", 5, 7),
        record("2025-10-05", "US", "VOO", 5, 6),
      ],
      asOf
    );
    expect(result.amountSgd).toBe(22);
    expect(result.count).toBe(2);
    expect(result.start.toISOString()).toBe("2025-10-06T00:00:00.000Z");
    expect(trailingDividendIncome([record("2025-10-06", "US", "VOO", 1, 1)], new Date("2026-10-06T18:00:00.000Z")).count).toBe(1);
  });

  it("clamps a leap-day lookback to the last valid February date", () => {
    expect(trailingDividendIncome([], new Date("2024-02-29T18:00:00.000Z")).start.toISOString())
      .toBe("2023-02-28T00:00:00.000Z");
  });

  it("returns zero and a valid range for an empty ledger", () => {
    expect(trailingDividendIncome([], asOf)).toMatchObject({ amountSgd: 0, count: 0 });
  });
});

describe("dividendPositionMetrics", () => {
  it("uses net native income, holding cost and region+ticker identity", () => {
    const metrics = dividendPositionMetrics(
      [
        record("2026-02-01", "US", "ABC", 10, 13, 2),
        record("2026-03-01", "US", "ABC", 5, 7),
        record("2026-02-01", "SG", "ABC", 20, 20),
        record("2025-10-05", "US", "ABC", 50, 65),
      ],
      [
        { region: "US", ticker: "ABC", qty: 10, avgCost: 20 },
        { region: "SG", ticker: "ABC", qty: 5, avgCost: 10 },
        { region: "HK", ticker: "0700", qty: 0, avgCost: 0 },
      ],
      asOf
    );
    expect(metrics[positionKey("US", "ABC")]).toEqual({ incomeNative: 15, yieldOnCost: 0.075 });
    expect(metrics[positionKey("SG", "ABC")]).toEqual({ incomeNative: 20, yieldOnCost: 0.4 });
    expect(metrics[positionKey("HK", "0700")]).toEqual({ incomeNative: 0, yieldOnCost: null });
  });

  it("normalizes ticker case in compound keys without merging regions", () => {
    expect(positionKey("US", "abc")).toBe("US::ABC");
    expect(positionKey("SG", "abc")).not.toBe(positionKey("US", "abc"));
  });
});

describe("dividendMonthlyHistory", () => {
  it("returns calendar months intersecting the trailing year with zero-filled months and actual net SGD totals", () => {
    const months = dividendMonthlyHistory(
      [
        record("2025-11-10", "US", "VOO", 10, 13),
        record("2025-11-22", "HK", "0700", 20, 4),
        record("2026-10-01", "SG", "D05", 5, 5),
        record("2026-10-07", "US", "VOO", 50, 65),
        record("2025-10-05", "SG", "D05", 8, 8),
      ],
      asOf
    );
    expect(months).toHaveLength(13);
    expect(months[0]).toMatchObject({ key: "2025-10", amountSgd: 0 });
    expect(months[1]).toMatchObject({ key: "2025-11", amountSgd: 17 });
    expect(months[2]).toMatchObject({ key: "2025-12", amountSgd: 0 });
    expect(months[12]).toMatchObject({ key: "2026-10", amountSgd: 5 });
  });
});
