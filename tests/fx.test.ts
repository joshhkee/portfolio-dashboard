import { describe, it, expect } from "vitest";
import { toUSD, convertCurrency, currencyForRegion, type FxRates } from "@/lib/fx";

const rates: FxRates = { SGD: 1.35, HKD: 7.8 };

describe("currencyForRegion", () => {
  it("maps regions to their currencies", () => {
    expect(currencyForRegion("US")).toBe("USD");
    expect(currencyForRegion("SG")).toBe("SGD");
    expect(currencyForRegion("HK")).toBe("HKD");
  });

  it("falls back to USD for unknown regions", () => {
    expect(currencyForRegion("XX")).toBe("USD");
  });
});

describe("toUSD", () => {
  it("leaves USD amounts untouched", () => {
    expect(toUSD(100, "US", rates)).toBe(100);
  });

  it("divides foreign amounts by the units-per-USD rate", () => {
    // 135 SGD at 1.35 SGD/USD = 100 USD
    expect(toUSD(135, "SG", rates)).toBeCloseTo(100, 6);
    expect(toUSD(780, "HK", rates)).toBeCloseTo(100, 6);
  });

  it("treats a missing rate as identity (fails soft, not hard)", () => {
    expect(toUSD(135, "SG", { SGD: 0, HKD: 7.8 })).toBe(135);
  });
});

describe("convertCurrency", () => {
  it("converts between two foreign currencies via USD", () => {
    // 135 SGD -> 100 USD -> 780 HKD
    expect(convertCurrency(135, "SG", "HKD", rates)).toBeCloseTo(780, 6);
  });

  it("converts foreign to SGD target", () => {
    // 780 HKD -> 100 USD -> 135 SGD
    expect(convertCurrency(780, "HK", "SGD", rates)).toBeCloseTo(135, 6);
  });

  it("is identity when source region currency equals target", () => {
    expect(convertCurrency(42.5, "SG", "SGD", rates)).toBeCloseTo(42.5, 6);
  });
});
