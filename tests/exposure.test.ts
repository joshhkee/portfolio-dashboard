import { describe, it, expect } from "vitest";
import {
  UNCLASSIFIED_LABEL,
  currencyExposure,
  fxAttribution,
  groupExposure,
  sectorExposure,
  sgdCostPerShare,
  toExposureLines,
  type ExposureLine,
} from "@/lib/exposure";
import { buildSgdRateSeries, sgdRateOn, rateSeriesSpan } from "@/lib/fx-history";
import type { RawTransaction } from "@/lib/portfolio-engine";

function line(
  region: string,
  ticker: string,
  valueSgd: number,
  sector: string | null
): ExposureLine {
  return { key: `${region}::${ticker}`, region, ticker, name: null, valueSgd, sector };
}

function tx(
  id: number,
  date: string,
  action: "Buy" | "Sell",
  region: string,
  ticker: string,
  qty: number,
  price: number
): RawTransaction {
  return { id, date: new Date(date), action, region, ticker, qty, price, notes: null };
}

describe("groupExposure", () => {
  const lines = [
    line("SG", "D05", 300, "Banks"),
    line("US", "VOO", 500, "US Equity Index"),
    line("HK", "1810", 200, "Consumer Tech"),
  ];

  it("weights are taken against the TOTAL including anything untagged", () => {
    const result = sectorExposure([...lines, line("US", "XYZ", 0, null)]);

    expect(result.totalValueSgd).toBe(1000);
    expect(result.buckets.map((b) => b.label)).toEqual([
      "US Equity Index",
      "Banks",
      "Consumer Tech",
    ]);
    expect(result.buckets[0].weight).toBeCloseTo(0.5, 10);
    expect(result.buckets.reduce((sum, b) => sum + b.weight, 0)).toBeCloseTo(1, 10);
    expect(result.unclassified).toBeNull();
    expect(result.coverage).toBe(1);
  });

  it("keeps untagged holdings as an explicit slice instead of an 'Other' bucket", () => {
    const result = sectorExposure([
      line("SG", "D05", 300, "Banks"),
      line("US", "VOO", 500, null),
      line("US", "QQQ", 200, null),
    ]);

    expect(result.buckets.map((b) => b.label)).toEqual(["Banks"]);
    expect(result.unclassified).not.toBeNull();
    expect(result.unclassified!.valueSgd).toBe(700);
    expect(result.unclassified!.positions).toBe(2);
    expect(result.unclassified!.weight).toBeCloseTo(0.7, 10);
    expect(result.coverage).toBeCloseTo(0.3, 10);
    expect(UNCLASSIFIED_LABEL).toBe("Unclassified");
    // Named buckets + unclassified still account for the whole pie.
    expect(
      result.buckets.reduce((sum, b) => sum + b.weight, 0) + result.unclassified!.weight
    ).toBeCloseTo(1, 10);
  });

  it("treats case and whitespace differences as ONE bucket", () => {
    const result = sectorExposure([
      line("SG", "D05", 100, "  banks "),
      line("SG", "O39", 300, "Banks"),
      line("US", "JPM", 100, "BANKS"),
    ]);

    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0].valueSgd).toBe(500);
    expect(result.buckets[0].positions).toBe(3);
    // The LARGEST position in the bucket supplies the spelling, so the label
    // doesn't depend on the order rows happened to arrive in.
    expect(result.buckets[0].label).toBe("Banks");
  });

  it("ignores zero and negative values — those are not holdings", () => {
    const result = sectorExposure([
      line("SG", "D05", 100, "Banks"),
      line("US", "ZERO", 0, "Banks"),
      line("US", "NEG", -50, "Banks"),
      line("US", "NAN", NaN, "Banks"),
    ]);

    expect(result.positions).toBe(1);
    expect(result.buckets[0].valueSgd).toBe(100);
  });

  it("returns an empty breakdown rather than NaN weights for no holdings", () => {
    const result = sectorExposure([]);

    expect(result.totalValueSgd).toBe(0);
    expect(result.buckets).toEqual([]);
    expect(result.unclassified).toBeNull();
    expect(result.coverage).toBe(0);
    expect(Number.isNaN(result.classified.weight)).toBe(false);
  });

  it("collapses a blank tag to unclassified, not to a bucket named ''", () => {
    const result = sectorExposure([line("SG", "D05", 100, "   ")]);

    expect(result.buckets).toEqual([]);
    expect(result.unclassified!.valueSgd).toBe(100);
  });

  it("groupExposure takes any tag function, so currencies reuse the same maths", () => {
    const result = currencyExposure([
      line("US", "VOO", 600, null),
      line("SG", "D05", 300, null),
      line("HK", "1810", 100, null),
    ]);

    expect(result.buckets.map((b) => b.label)).toEqual(["USD", "SGD", "HKD"]);
    // Every region maps to a currency, so this exposure is always complete.
    expect(result.unclassified).toBeNull();
    expect(result.coverage).toBe(1);
    expect(result.buckets[0].weight).toBeCloseTo(0.6, 10);
  });

  it("sector and currency groupings agree on the total they are slicing", () => {
    const lines = [
      line("US", "VOO", 600, "US Equity Index"),
      line("SG", "D05", 300, "Banks"),
      line("HK", "1810", 100, null),
    ];
    expect(sectorExposure(lines).totalValueSgd).toBe(currencyExposure(lines).totalValueSgd);
  });

  it("groupExposure is exercised directly so the tag function is covered", () => {
    const result = groupExposure([line("US", "VOO", 10, "anything")], (l) => l.ticker);
    expect(result.buckets[0].label).toBe("VOO");
  });
});

describe("toExposureLines", () => {
  it("tags by compound key, so the same ticker in two regions stays separate", () => {
    const lines = toExposureLines(
      [
        { region: "US", ticker: "ABC", name: "US ABC", valueSgd: 100 },
        { region: "SG", ticker: "ABC", name: "SG ABC", valueSgd: 200 },
      ],
      { "US::ABC": "US Tech", "SG::ABC": "SG Banks" }
    );

    expect(lines.map((l) => l.sector)).toEqual(["US Tech", "SG Banks"]);
  });

  it("an absent tag is null (unknown), never a guessed default", () => {
    const lines = toExposureLines(
      [{ region: "US", ticker: "ZZZ", name: null, valueSgd: 100 }],
      {}
    );
    expect(lines[0].sector).toBeNull();
  });
});

describe("fxAttribution", () => {
  it("gives an SGD position no phantom FX gain", () => {
    const result = fxAttribution([
      {
        key: "SG::D05",
        region: "SG",
        ticker: "D05",
        currency: "SGD",
        qty: 100,
        avgCost: 30,
        price: 33,
        avgCostSgd: 30,
        fxNow: 1,
      },
    ]);

    expect(result.fxPlSgd).toBe(0);
    expect(result.localPlSgd).toBeCloseTo(300, 10);
    expect(result.totalPlSgd).toBeCloseTo(300, 10);
    expect(result.rows[0].fxAtCost).toBe(1);
  });

  it("gives an SGD position an EXACTLY zero FX term, so it can't render as -S$0.00", () => {
    // Ragged prices on purpose: computed as the residual (total − local) this
    // lands on ±1e-13 and displays as "-S$0.00", which reads as a loss.
    const [row] = fxAttribution([
      {
        key: "SG::OV8",
        region: "SG",
        ticker: "OV8",
        currency: "SGD",
        qty: 37,
        avgCost: 27.22,
        price: 31.09,
        avgCostSgd: 27.22,
        fxNow: 1,
      },
    ]).rows;

    expect(row.fxPlSgd).toBe(0);
    expect(row.totalPlSgd).toBeCloseTo(37 * (31.09 - 27.22), 9);
  });

  it("attributes a purely currency-driven move to FX when the price is flat", () => {
    // Bought 10 shares at US$100 when SGD/USD was 1.30 (S$130/share). The share
    // price hasn't moved at all, but SGD has weakened to 1.40.
    const result = fxAttribution([
      {
        key: "US::VOO",
        region: "US",
        ticker: "VOO",
        currency: "USD",
        qty: 10,
        avgCost: 100,
        price: 100,
        avgCostSgd: 130,
        fxNow: 1.4,
      },
    ]);

    expect(result.localPlSgd).toBe(0);
    expect(result.fxPlSgd).toBeCloseTo(100, 10); // 10 × 100 × (1.40 − 1.30)
    expect(result.totalPlSgd).toBeCloseTo(100, 10);
    expect(result.rows[0].fxShareOfPl).toBeCloseTo(1, 10);
  });

  it("matches the closed form qty × avgCost × (fxNow − fxAtCost)", () => {
    const row = {
      key: "US::QQQ",
      region: "US",
      ticker: "QQQ",
      currency: "USD" as const,
      qty: 7,
      avgCost: 400,
      price: 460,
      avgCostSgd: 500, // blended purchase rate implies fxAtCost 1.25
      fxNow: 1.32,
    };

    const [out] = fxAttribution([row]).rows;
    expect(out.fxAtCost).toBeCloseTo(1.25, 10);
    expect(out.fxPlSgd).toBeCloseTo(row.qty * row.avgCost * (row.fxNow - out.fxAtCost), 9);
  });

  it("reconciles to the cent: local + fx equals the total, for every row and in aggregate", () => {
    const result = fxAttribution([
      {
        key: "US::VOO",
        region: "US",
        ticker: "VOO",
        currency: "USD",
        qty: 10,
        avgCost: 100,
        price: 130,
        avgCostSgd: 130,
        fxNow: 1.4,
      },
      {
        key: "HK::1810",
        region: "HK",
        ticker: "1810",
        currency: "HKD",
        qty: 200,
        avgCost: 20,
        price: 45,
        avgCostSgd: 3.4,
        fxNow: 0.171,
      },
      {
        key: "SG::D05",
        region: "SG",
        ticker: "D05",
        currency: "SGD",
        qty: 100,
        avgCost: 30,
        price: 28,
        avgCostSgd: 30,
        fxNow: 1,
      },
    ]);

    for (const row of result.rows) {
      expect(row.localPlSgd + row.fxPlSgd).toBeCloseTo(row.totalPlSgd, 9);
      expect(row.valueSgd - row.costSgd).toBeCloseTo(row.totalPlSgd, 9);
    }

    expect(result.localPlSgd + result.fxPlSgd).toBeCloseTo(result.totalPlSgd, 9);
    expect(result.valueSgd - result.costSgd).toBeCloseTo(result.totalPlSgd, 9);
    expect(result.fxPlSgd).toBeCloseTo(result.differenceSgd, 10);
  });

  it("reports the holdings page's own number as the local component", () => {
    // The holdings page converts native P&L at TODAY'S rate, which is exactly
    // localPlSgd — so the difference it leaves out is the FX term.
    const result = fxAttribution([
      {
        key: "US::VOO",
        region: "US",
        ticker: "VOO",
        currency: "USD",
        qty: 4,
        avgCost: 50,
        price: 60,
        avgCostSgd: 60,
        fxNow: 1.35,
      },
    ]);

    expect(result.headlinePlSgd).toBeCloseTo(4 * (60 - 50) * 1.35, 10);
    expect(result.headlinePlSgd + result.differenceSgd).toBeCloseTo(result.totalPlSgd, 9);
  });

  it("returns a null FX share when there is no P&L to attribute", () => {
    const result = fxAttribution([
      {
        key: "SG::D05",
        region: "SG",
        ticker: "D05",
        currency: "SGD",
        qty: 10,
        avgCost: 30,
        price: 30,
        avgCostSgd: 30,
        fxNow: 1,
      },
    ]);

    expect(result.totalPlSgd).toBe(0);
    expect(result.rows[0].fxShareOfPl).toBeNull();
    expect(result.fxShareOfPl).toBeNull();
  });

  it("sums an empty portfolio to zero rather than NaN", () => {
    const result = fxAttribution([]);
    expect(result.totalPlSgd).toBe(0);
    expect(result.fxShareOfPl).toBeNull();
    expect(result.rows).toEqual([]);
  });
});

describe("sgdCostPerShare", () => {
  it("converts each purchase at its OWN date's rate, not today's", () => {
    const costs = sgdCostPerShare([tx(1, "2025-01-01", "Buy", "US", "VOO", 10, 100)], () => 1.3);

    expect(costs["US::VOO"]).toBeCloseTo(130, 10);
  });

  it("blends multiple purchases by quantity AND purchase-date rate", () => {
    const byDate: Record<string, number> = { "2025-01-01": 1.3, "2025-06-01": 1.4 };
    const costs = sgdCostPerShare(
      [
        tx(1, "2025-01-01", "Buy", "US", "VOO", 10, 100),
        tx(2, "2025-06-01", "Buy", "US", "VOO", 10, 100),
      ],
      (_region, date) => byDate[date.toISOString().slice(0, 10)] ?? 1
    );

    // (10 × 130 + 10 × 140) / 20 = 135 — the blended purchase rate is 1.35.
    expect(costs["US::VOO"]).toBeCloseTo(135, 10);
  });

  it("carries the blended purchase cost through a partial sell", () => {
    const costs = sgdCostPerShare(
      [
        tx(1, "2025-01-01", "Buy", "US", "VOO", 10, 100),
        tx(2, "2025-06-01", "Buy", "US", "VOO", 10, 100),
        tx(3, "2025-07-01", "Sell", "US", "VOO", 5, 200),
      ],
      (_region, date) => (date.getUTCMonth() < 5 ? 1.3 : 1.4)
    );

    expect(costs["US::VOO"]).toBeCloseTo(135, 10);
  });

  it("starts a fresh cost after a full close and re-entry", () => {
    const costs = sgdCostPerShare(
      [
        tx(1, "2025-01-01", "Buy", "US", "VOO", 10, 100),
        tx(2, "2025-02-01", "Sell", "US", "VOO", 10, 120),
        tx(3, "2025-03-01", "Buy", "US", "VOO", 5, 100),
      ],
      (_region, date) => (date.getUTCMonth() === 2 ? 1.2 : 1.5)
    );

    expect(costs["US::VOO"]).toBeCloseTo(120, 10);
  });

  it("keys by region, so one ticker in two regions cannot collide", () => {
    const costs = sgdCostPerShare(
      [
        tx(1, "2025-01-01", "Buy", "US", "ABC", 1, 100),
        tx(2, "2025-01-01", "Buy", "SG", "ABC", 1, 10),
      ],
      (region) => (region === "US" ? 1.3 : 1)
    );

    expect(costs["US::ABC"]).toBeCloseTo(130, 10);
    expect(costs["SG::ABC"]).toBeCloseTo(10, 10);
  });

  it("omits fully closed positions", () => {
    const costs = sgdCostPerShare(
      [
        tx(1, "2025-01-01", "Buy", "US", "VOO", 10, 100),
        tx(2, "2025-02-01", "Sell", "US", "VOO", 10, 120),
      ],
      () => 1.3
    );

    expect(costs["US::VOO"]).toBeUndefined();
  });
});

describe("historical SGD rates", () => {
  const sgdPerUsd = { "2025-01-02": 1.36, "2025-01-06": 1.34 };
  const hkdPerUsd = { "2025-01-02": 7.8, "2025-01-06": 7.79 };

  it("derives the HKD cross rate from the two USD-quoted series", () => {
    const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);

    expect(series.USD["2025-01-02"]).toBeCloseTo(1.36, 10);
    expect(series.HKD["2025-01-02"]).toBeCloseTo(1.36 / 7.8, 10);
    expect(series.SGD["2025-01-02"]).toBe(1);
  });

  it("carries the last close forward across a gap instead of returning a hole", () => {
    const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);

    expect(sgdRateOn(series, "USD", "2025-01-04")).toBeCloseTo(1.36, 10);
    expect(sgdRateOn(series, "HKD", "2025-01-04")).toBeCloseTo(1.36 / 7.8, 10);
  });

  it("returns null before the series starts, so the caller can count the fallback", () => {
    const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);

    expect(sgdRateOn(series, "USD", "2024-12-31")).toBeNull();
    expect(sgdRateOn(series, "USD", "2025-01-02")).toBeCloseTo(1.36, 10);
  });

  it("still answers for SGD itself, and reports a null span when there is no data", () => {
    const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);
    expect(sgdRateOn(series, "SGD", "2025-01-04")).toBe(1);

    const empty = buildSgdRateSeries({}, {});
    expect(sgdRateOn(empty, "USD", "2025-01-04")).toBeNull();
    expect(rateSeriesSpan(empty)).toEqual({ from: null, to: null });
    expect(rateSeriesSpan(series)).toEqual({ from: "2025-01-02", to: "2025-01-06" });
  });

  it("tolerates a day present in only one series", () => {
    const series = buildSgdRateSeries(
      { "2025-01-02": 1.36 },
      { "2025-01-02": 7.8, "2025-01-03": 7.81 }
    );

    // 2025-01-03 has an HKD close but no fresh SGD close; the SGD rate is
    // carried so the cross rate is still derivable rather than undefined.
    expect(series.HKD["2025-01-03"]).toBeCloseTo(1.36 / 7.81, 10);
  });
});
