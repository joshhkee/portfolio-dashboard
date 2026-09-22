import { describe, it, expect } from "vitest";
import {
  closeOn,
  contributionAttribution,
  groupByQuarter,
  monthEnd,
  monthKeysBetween,
  holdingsValueOn,
  rangeIndices,
  selectColumns,
  type AttributionInput,
} from "@/lib/attribution";
import type { RawTransaction } from "@/lib/portfolio-engine";
import type { HistoricalCloses } from "@/lib/prices";

function tx(
  id: number,
  date: string,
  action: "Buy" | "Sell",
  region: string,
  ticker: string,
  qty: number,
  price: number
): RawTransaction {
  return { id, date: new Date(`${date}T00:00:00.000Z`), action, region, ticker, qty, price, notes: null };
}

/** Flat 1:1 FX so the arithmetic in these tests stays readable. */
function noFx() {
  return () => ({ rate: 1, fallback: false });
}

function closesFor(series: Record<string, HistoricalCloses>): Record<string, HistoricalCloses> {
  return series;
}

describe("month helpers", () => {
  it("lists month keys inclusively across a year boundary", () => {
    expect(
      monthKeysBetween(new Date("2025-11-05T00:00:00Z"), new Date("2026-02-10T00:00:00Z"))
    ).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("returns the last calendar day of a month, including February in a leap year", () => {
    expect(monthEnd("2025-01")).toBe("2025-01-31");
    expect(monthEnd("2025-02")).toBe("2025-02-28");
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(monthEnd("2025-12")).toBe("2025-12-31");
  });

  it("carries a close forward and returns null before the series starts", () => {
    const closes: HistoricalCloses = { "2025-01-02": 10, "2025-01-06": 12 };
    expect(closeOn(closes, "2025-01-04")).toBe(10);
    expect(closeOn(closes, "2025-01-06")).toBe(12);
    expect(closeOn(closes, "2024-12-01")).toBeNull();
    expect(closeOn(undefined, "2025-01-04")).toBeNull();
  });
});

describe("contributionAttribution", () => {
  it("gives a position that only absorbed money a zero contribution", () => {
    // Bought 10 @ 100 in Jan and the price never moved: the portfolio grew by
    // 1000 because 1000 was paid in, so nothing was EARNED.
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 100, "2025-02-28": 100 } }),
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0].total).toBeCloseTo(0, 9);
    expect(matrix.total).toBeCloseTo(0, 9);
  });

  it("attributes a pure price gain to the holding that earned it", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({
          "US::VOO": { "2025-01-31": 110, "2025-02-28": 130 },
        }),
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    const row = matrix.rows[0];
    expect(row.values).toHaveLength(2);
    // 10 shares: +100 in January (100 -> 110) and +200 in February (110 -> 130).
    expect(row.values[0]).toBeCloseTo(100, 9);
    expect(row.values[1]).toBeCloseTo(200, 9);
    expect(row.total).toBeCloseTo(300, 9);
    expect(matrix.columnTotals).toEqual([expect.closeTo(100, 9), expect.closeTo(200, 9)]);
    expect(matrix.total).toBeCloseTo(300, 9);
  });

  it("accounts for a partially sold position across the period it was trimmed", () => {
    // 10 @ 100, price rises to 120, then 4 are sold at 120.
    const matrix = contributionAttribution(
      {
        transactions: [
          tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100),
          tx(2, "2025-02-10", "Sell", "US", "VOO", 4, 120),
        ],
        closes: closesFor({ "US::VOO": { "2025-01-31": 120, "2025-02-28": 120 } }),
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    const row = matrix.rows[0];
    expect(row.values[0]).toBeCloseTo(200, 9); // 10 × (120 − 100)
    // February: value 1200 -> 720 (6 shares), minus the 480 received = 0. The
    // price didn't move in February, so there is nothing more to earn.
    expect(row.values[1]).toBeCloseTo(0, 9);
    expect(row.total).toBeCloseTo(200, 9);
    expect(row.openQty).toBeCloseTo(6, 9);
  });

  it("credits a closed position with its realized gain, and keeps it in the grid", () => {
    const matrix = contributionAttribution(
      {
        transactions: [
          tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100),
          tx(2, "2025-02-10", "Sell", "US", "VOO", 10, 150),
        ],
        closes: closesFor({ "US::VOO": { "2025-01-31": 140, "2025-02-28": 150 } }),
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    const row = matrix.rows[0];
    expect(row.openQty).toBe(0);
    expect(row.total).toBeCloseTo(500, 9); // 10 × (150 − 100)
    // A closed position must still be listed — that gain really happened.
    expect(matrix.rows.map((r) => r.ticker)).toContain("VOO");
  });

  it("splits one total across two positions, both of which reconcile", () => {
    const matrix = contributionAttribution(
      {
        transactions: [
          tx(1, "2025-01-05", "Buy", "US", "AAA", 10, 100),
          tx(2, "2025-01-06", "Buy", "SG", "BBB", 10, 50),
        ],
        closes: closesFor({
          "US::AAA": { "2025-01-31": 120 },
          "SG::BBB": { "2025-01-31": 40 },
        }),
        sgdRate: noFx(),
      },
      "2025-01-31"
    );

    const byTicker = Object.fromEntries(matrix.rows.map((r) => [r.ticker, r.total]));
    expect(byTicker["AAA"]).toBeCloseTo(200, 9);
    expect(byTicker["BBB"]).toBeCloseTo(-100, 9);
    expect(matrix.total).toBeCloseTo(100, 9);
  });

  it("sums the monthly columns to exactly the same total as one single period", () => {
    // The property that makes the period split trustworthy: slicing the window
    // reassigns nothing, it only redistributes.
    const transactions = [
      tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100),
      tx(2, "2025-02-14", "Buy", "US", "VOO", 5, 130),
      tx(3, "2025-03-20", "Sell", "US", "VOO", 3, 140),
    ];
    const closes = closesFor({
      "US::VOO": {
        "2025-01-31": 112,
        "2025-02-28": 128,
        "2025-03-31": 135,
      },
    });

    const monthly = contributionAttribution(
      { transactions, closes, sgdRate: noFx() },
      "2025-03-31"
    );
    // Last boundary value minus every dollar paid in, computed by hand from the
    // same inputs, is what the grid must add up to.
    const last: HistoricalCloses = { "2025-03-31": 135 };
    const valueAtEnd = 12 * closeOn(closes["US::VOO"], "2025-03-31")!;
    const paidIn = 10 * 100 + 5 * 130 - 3 * 140;
    expect(monthly.total).toBeCloseTo(valueAtEnd - paidIn, 9);
    expect(monthly.columnTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(monthly.total, 9);
    expect(last).toBeDefined();
  });

  it("values an instrument with no price history at cost, so it can't fake a gain", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "HK", "1810", 100, 20)],
        closes: closesFor({}), // Yahoo returns nothing for this symbol
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    expect(matrix.rows[0].total).toBeCloseTo(0, 9);
    expect(matrix.unpriced).toEqual(["HK::1810"]);
  });

  it("labels the columns with their month and the day each period ends", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 110, "2025-02-28": 130 } }),
        sgdRate: noFx(),
      },
      "2025-02-28"
    );

    expect(matrix.columns.map((c) => c.key)).toEqual(["2025-01", "2025-02"]);
    expect(matrix.columns.map((c) => c.label)).toEqual(["Jan 25", "Feb 25"]);
    expect(matrix.columns.map((c) => c.endDay)).toEqual(["2025-01-31", "2025-02-28"]);
    expect(matrix.baselineDay).toBe("2025-01-09");
  });

  it("calls the FX rate at each month end and at each trade's own date", () => {
    const seen: string[] = [];
    contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 100 } }),
        sgdRate: (_region, day) => {
          seen.push(day);
          return { rate: 1.3, fallback: false };
        },
      },
      "2025-01-31"
    );

    expect(seen).toContain("2025-01-31");
    expect(seen).toContain("2025-01-10"); // the trade's own date, not today's
  });

  it("counts DISTINCT fallback dates, not every lookup that used one", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 100 } }),
        sgdRate: () => ({ rate: 1.3, fallback: true }),
      },
      "2025-01-31"
    );

    // Two distinct dates here (the purchase and the period end), however many
    // times each was asked for.
    expect(matrix.fxFallbacks).toBe(2);
  });

  it("returns an empty grid for an empty ledger rather than throwing", () => {
    const matrix = contributionAttribution(
      { transactions: [], closes: closesFor({}), sgdRate: noFx() },
      "2025-02-28"
    );

    expect(matrix.rows).toEqual([]);
    expect(matrix.total).toBe(0);
    expect(matrix.columns).toEqual([]);
  });

  it("ends the current month at today, not at the calendar month end", () => {
    const matrix = contributionAttribution(
      { transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 1, 100)], closes: closesFor({}), sgdRate: noFx() },
      "2025-01-15"
    );

    expect(matrix.columns[0].endDay).toBe("2025-01-15");
  });

  it("converts the cash paid in at the trade's own rate, leaving FX out of it", () => {
    // Bought 10 @ 100 USD when SGD/USD was 1.50, so S$1,500 went in. Valued at
    // the same 1.50 at month end with a flat price, the contribution is 0 — the
    // FX move does not register because both ends use the same rate.
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 100 } }),
        sgdRate: () => ({ rate: 1.5, fallback: false }),
      },
      "2025-01-31"
    );

    expect(matrix.total).toBeCloseTo(0, 9);
  });
});

describe("holdingsValueOn", () => {
  const snapshots = [
    { date: "2025-01-31", holdingsValueSgd: 100 },
    { date: "2025-02-28", holdingsValueSgd: 140 },
    { date: "2025-03-31", holdingsValueSgd: 150 },
  ];

  it("reads the last stored value at or before the day", () => {
    expect(holdingsValueOn(snapshots, "2025-02-28")).toBe(140);
    expect(holdingsValueOn(snapshots, "2025-03-15")).toBe(140);
    expect(holdingsValueOn(snapshots, "2025-03-31")).toBe(150);
  });

  it("reads zero before the series starts rather than the first later value", () => {
    expect(holdingsValueOn(snapshots, "2024-12-31")).toBe(0);
    expect(holdingsValueOn([], "2025-02-28")).toBe(0);
  });
});

describe("the snapshot cross-check", () => {
  it("reconciles when both price histories agree", () => {
    // The stored holdings values are exactly the prices the grid is given, so
    // the cross-check has nothing to find.
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 110, "2025-02-28": 130 } }),
        sgdRate: noFx(),
        snapshots: [
          { date: "2025-01-09", holdingsValueSgd: 0 },
          { date: "2025-01-31", holdingsValueSgd: 1100 },
          { date: "2025-02-28", holdingsValueSgd: 1300 },
        ],
      },
      "2025-02-28"
    );

    expect(matrix.snapshotGain[0]).toBeCloseTo(matrix.columnTotals[0], 9);
    expect(matrix.snapshotGain[1]).toBeCloseTo(matrix.columnTotals[1], 9);
  });

  it("exposes the disagreement when the stored prices differ", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 110 } }),
        sgdRate: noFx(),
        snapshots: [{ date: "2025-01-31", holdingsValueSgd: 1090 }],
      },
      "2025-01-31"
    );

    expect(matrix.columnTotals[0]).toBeCloseTo(100, 9);
    expect(matrix.snapshotGain[0]).toBeCloseTo(90, 9);
  });

  it("subtracts the SAME cash term from the cross-check as from the grid", () => {
    // A month with a large purchase must not show the purchase as a gain on
    // either side.
    const matrix = contributionAttribution(
      {
        transactions: [
          tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100),
          tx(2, "2025-02-10", "Buy", "US", "VOO", 10, 100),
        ],
        closes: closesFor({ "US::VOO": { "2025-01-31": 100, "2025-02-28": 100 } }),
        sgdRate: noFx(),
        snapshots: [
          { date: "2025-01-31", holdingsValueSgd: 1000 },
          { date: "2025-02-28", holdingsValueSgd: 2000 },
        ],
      },
      "2025-02-28"
    );

    expect(matrix.columnTotals[1]).toBeCloseTo(0, 9);
    expect(matrix.snapshotGain[1]).toBeCloseTo(0, 9);
    expect(matrix.netInvestedTotal).toBeCloseTo(2000, 9);
  });

  it("reports zero cross-check values when no snapshots are supplied", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 110 } }),
        sgdRate: noFx(),
      },
      "2025-01-31"
    );

    expect(matrix.snapshotGain).toEqual([0]);
    expect(matrix.columnTotals[0]).toBeCloseTo(100, 9);
  });
});

describe("rangeIndices", () => {
  const columns = [
    { key: "2025-01", label: "Jan 25", endDay: "2025-01-31" },
    { key: "2025-06", label: "Jun 25", endDay: "2025-06-30" },
    { key: "2026-09", label: "Sep 26", endDay: "2026-09-22" },
  ];
  const now = new Date("2026-09-22T00:00:00.000Z");

  it("returns everything for ALL", () => {
    expect(rangeIndices(columns, "ALL", now)).toEqual([0, 1, 2]);
  });

  it("keeps only periods ending inside the window", () => {
    expect(rangeIndices(columns, "3M", now)).toEqual([2]);
    expect(rangeIndices(columns, "1Y", now)).toEqual([2]);
  });

  it("takes YTD from January 1st of the current year, cutting last December", () => {
    const spanning = [
      { key: "2025-12", label: "Dec 25", endDay: "2025-12-31" },
      { key: "2026-03", label: "Mar 26", endDay: "2026-03-31" },
      { key: "2026-09", label: "Sep 26", endDay: "2026-09-22" },
    ];
    expect(rangeIndices(spanning, "YTD", now)).toEqual([1, 2]);
    // …while ALL still includes it.
    expect(rangeIndices(spanning, "ALL", now)).toEqual([0, 1, 2]);
  });

  it("never returns an empty selection — a window older than the history shows all", () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    expect(rangeIndices(columns, "1M", old)).toEqual([0, 1, 2]);
  });
});

describe("selectColumns", () => {
  it("narrows columns and recomputes every derived total", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({ "US::VOO": { "2025-01-31": 110, "2025-02-28": 130 } }),
        sgdRate: noFx(),
        snapshots: [
          { date: "2025-01-31", holdingsValueSgd: 1100 },
          { date: "2025-02-28", holdingsValueSgd: 1300 },
        ],
      },
      "2025-02-28"
    );

    const narrowed = selectColumns(matrix, [1]);
    expect(narrowed.columns.map((c) => c.key)).toEqual(["2025-02"]);
    expect(narrowed.rows[0].values).toEqual([expect.closeTo(200, 9)]);
    expect(narrowed.rows[0].total).toBeCloseTo(200, 9);
    expect(narrowed.columnTotals[0]).toBeCloseTo(200, 9);
    expect(narrowed.total).toBeCloseTo(200, 9);
    expect(narrowed.snapshotGain).toEqual([expect.closeTo(200, 9)]);
  });
});

describe("groupByQuarter", () => {
  it("folds months into calendar quarters and sums each row", () => {
    const matrix = contributionAttribution(
      {
        transactions: [tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100)],
        closes: closesFor({
          "US::VOO": {
            "2025-01-31": 105,
            "2025-02-28": 115,
            "2025-03-31": 120,
            "2025-04-30": 130,
          },
        }),
        sgdRate: noFx(),
        // The stored holdings values are the grid's own, so the cross-check has
        // nothing to find and the quarter grouping can be checked against it.
        snapshots: [
          { date: "2025-01-31", holdingsValueSgd: 1050 },
          { date: "2025-02-28", holdingsValueSgd: 1150 },
          { date: "2025-03-31", holdingsValueSgd: 1200 },
          { date: "2025-04-30", holdingsValueSgd: 1300 },
        ],
      },
      "2025-04-30"
    );

    const quarterly = groupByQuarter(matrix);
    expect(quarterly.columns.map((c) => c.key)).toEqual(["2025-Q1", "2025-Q2"]);
    expect(quarterly.columns[0].label).toBe("Q1 25");
    expect(quarterly.columns[0].endDay).toBe("2025-03-31");
    // Q1 = 50 + 100 + 50, Q2 = 100.
    expect(quarterly.rows[0].values).toEqual([expect.closeTo(200, 9), expect.closeTo(100, 9)]);
    expect(quarterly.rows[0].total).toBeCloseTo(300, 9);
    expect(quarterly.columnTotals[1]).toBeCloseTo(100, 9);
    expect(quarterly.snapshotGain).toEqual(quarterly.columnTotals);
  });

  it("reconciles: quarter totals equal the month totals they replaced", () => {
    const matrix = contributionAttribution(
      {
        transactions: [
          tx(1, "2025-01-10", "Buy", "US", "VOO", 10, 100),
          tx(2, "2025-02-14", "Buy", "SG", "D05", 20, 30),
        ],
        closes: closesFor({
          "US::VOO": { "2025-01-31": 108, "2025-02-28": 118, "2025-03-31": 121 },
          "SG::D05": { "2025-01-31": 31, "2025-02-28": 29, "2025-03-31": 33 },
        }),
        sgdRate: noFx(),
      },
      "2025-03-31"
    );

    const quarterly = groupByQuarter(matrix);
    expect(quarterly.total).toBeCloseTo(matrix.total, 9);
    expect(quarterly.columnTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(matrix.total, 9);
  });
});

describe("AttributionInput", () => {
  it("sorts rows by contribution, biggest first", () => {
    const input: AttributionInput = {
      transactions: [
        tx(1, "2025-01-05", "Buy", "US", "SMALL", 1, 10),
        tx(2, "2025-01-05", "Buy", "US", "BIG", 100, 100),
      ],
      closes: closesFor({
        "US::SMALL": { "2025-01-31": 12 },
        "US::BIG": { "2025-01-31": 110 },
      }),
      sgdRate: noFx(),
    };
    const matrix = contributionAttribution(input, "2025-01-31");

    expect(matrix.rows.map((r) => r.ticker)).toEqual(["BIG", "SMALL"]);
    expect(matrix.rows[0].total).toBeCloseTo(1000, 9);
  });
});
