import { describe, it, expect } from "vitest";
import { parseChartMeta, priceKey, toYahooSymbol } from "@/lib/prices";

/** Shape captured from a real v8 chart response for VOO. */
function chartPayload(meta: Record<string, unknown>) {
  return { chart: { result: [{ meta }], error: null } };
}

describe("parseChartMeta", () => {
  it("extracts price, name, type, exchange and currency", () => {
    const parsed = parseChartMeta(
      chartPayload({
        symbol: "VOO",
        longName: "Vanguard S&P 500 ETF",
        shortName: "Vanguard S&P 500 ETF",
        instrumentType: "ETF",
        fullExchangeName: "NYSEArca",
        currency: "USD",
        regularMarketPrice: 711.54,
        // Yahoo reports this in PERCENT units, despite the field's name.
        regularMarketChangePercent: 0.569,
      })
    );
    expect(parsed).toEqual({
      price: 711.54,
      name: "Vanguard S&P 500 ETF",
      instrumentType: "ETF",
      exchange: "NYSEArca",
      currency: "USD",
      dayChangePct: 0.00569,
    });
  });

  it("converts the reported change from percent to a fraction", () => {
    expect(
      parseChartMeta(chartPayload({ regularMarketChangePercent: -0.8 }))?.dayChangePct
    ).toBeCloseTo(-0.008, 10);
  });

  it("leaves the day change null when the source omits or mangles it", () => {
    expect(parseChartMeta(chartPayload({ regularMarketPrice: 1 }))?.dayChangePct).toBeNull();
    expect(
      parseChartMeta(chartPayload({ regularMarketChangePercent: null }))?.dayChangePct
    ).toBeNull();
    expect(
      parseChartMeta(chartPayload({ regularMarketChangePercent: "0.5" }))?.dayChangePct
    ).toBeNull();
    expect(
      parseChartMeta(chartPayload({ regularMarketChangePercent: NaN }))?.dayChangePct
    ).toBeNull();
  });

  it("prefers longName over shortName", () => {
    const parsed = parseChartMeta(
      chartPayload({ longName: "Vanguard S&P 500 ETF", shortName: "VOO" })
    );
    expect(parsed?.name).toBe("Vanguard S&P 500 ETF");
  });

  it("falls back to shortName when longName is absent", () => {
    const parsed = parseChartMeta(chartPayload({ shortName: "Xiaomi Corporation" }));
    expect(parsed?.name).toBe("Xiaomi Corporation");
  });

  it("returns null (not a crash) for FX pairs, which carry no name", () => {
    // "SGD=X" is what fetchFxRates() looks up — it has a price but no name,
    // which is why every field is nullable rather than assumed.
    const parsed = parseChartMeta(chartPayload({ symbol: "SGD=X", regularMarketPrice: 1.35 }));
    expect(parsed).not.toBeNull();
    expect(parsed?.price).toBe(1.35);
    expect(parsed?.name).toBeNull();
  });

  it("treats whitespace-only names as missing", () => {
    expect(parseChartMeta(chartPayload({ longName: "   " }))?.name).toBeNull();
  });

  it("trims surrounding whitespace in names", () => {
    expect(parseChartMeta(chartPayload({ longName: " DBS Group " }))?.name).toBe("DBS Group");
  });

  it("leaves price null when the field is missing or the wrong type", () => {
    expect(parseChartMeta(chartPayload({ longName: "X" }))?.price).toBeNull();
    expect(parseChartMeta(chartPayload({ regularMarketPrice: "711.54" }))?.price).toBeNull();
  });

  it("rejects null price rather than coercing it to 0", () => {
    // A null regularMarketPrice must not become 0 — a zero price would
    // silently value the whole position at nothing.
    expect(parseChartMeta(chartPayload({ regularMarketPrice: null }))?.price).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(parseChartMeta(null)).toBeNull();
    expect(parseChartMeta({})).toBeNull();
    expect(parseChartMeta({ chart: {} })).toBeNull();
    expect(parseChartMeta({ chart: { result: [] } })).toBeNull();
    expect(parseChartMeta({ chart: { result: [{}] } })).toBeNull();
    expect(parseChartMeta("nonsense")).toBeNull();
  });
});

describe("toYahooSymbol", () => {
  it("maps each region to Yahoo's convention", () => {
    expect(toYahooSymbol("US", "VOO")).toBe("VOO");
    expect(toYahooSymbol("SG", "D05")).toBe("D05.SI");
    expect(toYahooSymbol("HK", "700")).toBe("0700.HK");
  });

  it("normalises HK codes to exactly 4 digits", () => {
    expect(toYahooSymbol("HK", "0700")).toBe("0700.HK");
    expect(toYahooSymbol("HK", "1810")).toBe("1810.HK");
    expect(toYahooSymbol("HK", "3115")).toBe("3115.HK");
  });

  it("passes non-numeric HK tickers through unchanged", () => {
    expect(toYahooSymbol("HK", "ABC")).toBe("ABC.HK");
  });
});

describe("priceKey", () => {
  it("keeps the same symbol distinct across regions", () => {
    expect(priceKey("US", "VOO")).not.toBe(priceKey("SG", "VOO"));
    expect(priceKey("US", "VOO")).toBe("US::VOO");
  });
});
