import { describe, it, expect } from "vitest";
import { watchlistRows } from "@/lib/watchlist";
import { priceKey, type DayChangeMap, type MetaMap, type PriceMap } from "@/lib/prices";

const EMPTY = {
  prices: {} as PriceMap,
  meta: {} as MetaMap,
  dayChanges: {} as DayChangeMap,
};

describe("watchlistRows", () => {
  it("resolves the name, the price and today's move", () => {
    const rows = watchlistRows(
      [{ id: 3, region: "US", ticker: "XLV", notes: null }],
      {
        prices: { "US::XLV": 148.2 },
        meta: { "US::XLV": { name: "State Street Health Care Select Sector SPDR ETF" } as never },
        dayChanges: { "US::XLV": 0.0042 },
      }
    );
    expect(rows).toEqual([
      {
        id: 3,
        region: "US",
        ticker: "XLV",
        notes: null,
        name: "State Street Health Care Select Sector SPDR ETF",
        price: 148.2,
        dayChangePct: 0.0042,
        targetBuyPrice: null,
        targetAllocPct: null,
        targetProximityPct: null,
      },
    ]);
  });

  it("prefers a cached name, since that one may have been hand-edited", () => {
    const rows = watchlistRows(
      [{ id: 5, region: "US", ticker: "CRWD", notes: "Waiting for a pullback" }],
      {
        ...EMPTY,
        meta: { "US::CRWD": { name: "CrowdStrike Holdings, Inc." } as never },
      },
      { "US::CRWD": "CrowdStrike" }
    );
    expect(rows[0].name).toBe("CrowdStrike");
    expect(rows[0].notes).toBe("Waiting for a pullback");
  });

  it("answers null rather than guessing when the quote is missing", () => {
    // A ticker being delisted, mistyped, or simply unresolvable must render as
    // dashes on the row, never as a zero price or a fabricated move.
    const rows = watchlistRows([{ id: 1, region: "HK", ticker: "9999", notes: null }], EMPTY);
    expect(rows[0].price).toBeNull();
    expect(rows[0].dayChangePct).toBeNull();
    expect(rows[0].name).toBeNull();
  });

  it("keeps the same symbol distinct across regions", () => {
    const rows = watchlistRows(
      [
        { id: 1, region: "US", ticker: "VOO", notes: null },
        { id: 2, region: "SG", ticker: "VOO", notes: null },
      ],
      { ...EMPTY, prices: { [priceKey("US", "VOO")]: 711.54, [priceKey("SG", "VOO")]: 15.2 } }
    );
    expect(rows[0].price).toBe(711.54);
    expect(rows[1].price).toBe(15.2);
  });

  it("normalises a blank note to null so the cell reads as empty, not as text", () => {
    const rows = watchlistRows(
      [
        { id: 1, region: "US", ticker: "XLF", notes: "   " },
        { id: 2, region: "US", ticker: "XLV", notes: "  Rate cuts  " },
      ],
      EMPTY
    );
    expect(rows[0].notes).toBeNull();
    expect(rows[1].notes).toBe("Rate cuts");
  });

  it("calculates target proximity percentage accurately", () => {
    const rows = watchlistRows(
      [
        {
          id: 1,
          region: "US",
          ticker: "NVDA",
          notes: null,
          targetBuyPrice: 100,
          targetAllocPct: 0.05,
        },
        {
          id: 2,
          region: "US",
          ticker: "AAPL",
          notes: null,
          targetBuyPrice: 200,
          targetAllocPct: 0.1,
        },
      ],
      {
        prices: { "US::NVDA": 95, "US::AAPL": 210 },
        meta: {} as MetaMap,
        dayChanges: {} as DayChangeMap,
      }
    );

    // NVDA: (95 - 100) / 100 = -0.05 (-5%, below target)
    expect(rows[0].targetBuyPrice).toBe(100);
    expect(rows[0].targetAllocPct).toBe(0.05);
    expect(rows[0].targetProximityPct).toBeCloseTo(-0.05, 5);

    // AAPL: (210 - 200) / 200 = 0.05 (+5%, above target)
    expect(rows[1].targetBuyPrice).toBe(200);
    expect(rows[1].targetAllocPct).toBe(0.1);
    expect(rows[1].targetProximityPct).toBeCloseTo(0.05, 5);
  });
});
