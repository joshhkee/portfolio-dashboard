import { describe, it, expect } from "vitest";
import {
  UNCLASSIFIED_LABEL,
  currencyExposure,
  groupExposure,
  sectorExposure,
  toExposureLines,
  type ExposureLine,
} from "@/lib/exposure";
import { buildSgdRateSeries, sgdRateOn } from "@/lib/fx-history";

function line(
  region: string,
  ticker: string,
  valueSgd: number,
  sector: string | null
): ExposureLine {
  return { key: `${region}::${ticker}`, region, ticker, name: null, valueSgd, sector };
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

  it("still answers for SGD itself", () => {
    const series = buildSgdRateSeries(sgdPerUsd, hkdPerUsd);
    expect(sgdRateOn(series, "SGD", "2025-01-04")).toBe(1);

    const empty = buildSgdRateSeries({}, {});
    expect(sgdRateOn(empty, "USD", "2025-01-04")).toBeNull();
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
