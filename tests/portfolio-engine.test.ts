import { describe, it, expect } from "vitest";
import {
  computeLedger,
  fromDbRows,
  withLivePrices,
  findNegativeQtyAfter,
  findFirstNegativeQty,
  type RawTransaction,
} from "@/lib/portfolio-engine";

function tx(
  id: number,
  date: string,
  action: "Buy" | "Sell",
  ticker: string,
  region: string,
  qty: number,
  price: number,
  notes?: string | null
): RawTransaction {
  return { id, date: new Date(date), action, ticker, region, qty, price, notes: notes ?? null };
}

describe("computeLedger", () => {
  it("blends weighted-average cost across buys", () => {
    const { ledger, openPositions } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-02-01", "Buy", "VOO", "US", 10, 600),
    ]);
    // (10*500 + 10*600) / 20 = 550
    expect(openPositions).toHaveLength(1);
    expect(openPositions[0].qty).toBe(20);
    expect(openPositions[0].avgCost).toBeCloseTo(550, 6);
    expect(ledger[1].runningAvgCost).toBeCloseTo(550, 6);
    expect(ledger[1].runningQty).toBe(20);
  });

  it("realizes P/L against the average cost at sale time", () => {
    const { completedTrades } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-03-01", "Sell", "VOO", "US", 4, 625),
    ]);
    expect(completedTrades).toHaveLength(1);
    const trade = completedTrades[0];
    expect(trade.qtySold).toBe(4);
    expect(trade.avgCost).toBeCloseTo(500, 6);
    expect(trade.realizedPL).toBeCloseTo((625 - 500) * 4, 6);
    expect(trade.returnPct).toBeCloseTo(0.25, 6);
  });

  it("carries the average cost forward after a partial sell", () => {
    const { ledger, openPositions } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-03-01", "Sell", "VOO", "US", 4, 625),
    ]);
    expect(openPositions[0].qty).toBe(6);
    expect(openPositions[0].avgCost).toBeCloseTo(500, 6);
    // Ledger is one row per transaction, chronological: buy, sell.
    expect(ledger).toHaveLength(2);
    expect(ledger[1].runningQty).toBe(6);
    expect(ledger[1].runningAvgCost).toBeCloseTo(500, 6);
  });

  it("resets the average cost after a full exit — next buy starts fresh", () => {
    const { openPositions } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-02-01", "Sell", "VOO", "US", 10, 700),
      tx(3, "2025-03-01", "Buy", "VOO", "US", 5, 1000),
    ]);
    expect(openPositions).toHaveLength(1);
    expect(openPositions[0].qty).toBe(5);
    expect(openPositions[0].avgCost).toBeCloseTo(1000, 6);
    expect(openPositions[0].heldSince).toEqual(new Date("2025-03-01"));
  });

  it("keeps the original heldSince when buying into an open position", () => {
    const { openPositions } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-02-01", "Buy", "VOO", "US", 10, 600),
    ]);
    expect(openPositions[0].heldSince).toEqual(new Date("2025-01-01"));
  });

  it("tracks positions independently per (region, ticker)", () => {
    const { openPositions } = computeLedger([
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-01-01", "Buy", "VOO", "SG", 5, 40),
      tx(3, "2025-01-02", "Sell", "VOO", "US", 10, 550),
    ]);
    expect(openPositions).toHaveLength(1);
    expect(openPositions[0].region).toBe("SG");
  });

  it("sorts same-day transactions by insertion id", () => {
    const { ledger } = computeLedger([
      tx(2, "2025-01-01", "Buy", "B", "US", 1, 100),
      tx(1, "2025-01-01", "Buy", "A", "US", 1, 100),
    ]);
    expect(ledger.map((r) => r.id)).toEqual([1, 2]);
  });

  it("sorts across dates regardless of input order", () => {
    const { ledger } = computeLedger([
      tx(1, "2025-03-01", "Buy", "A", "US", 1, 100),
      tx(2, "2025-01-01", "Buy", "A", "US", 1, 100),
    ]);
    expect(ledger[0].date.getTime()).toBeLessThan(ledger[1].date.getTime());
  });

  it("round-trips through fromDbRows", () => {
    const rows = [
      {
        id: 1,
        date: new Date("2025-01-01"),
        action: "Buy",
        ticker: "VOO",
        region: "US",
        qty: 10,
        price: 500,
        notes: null,
      },
    ];
    const { openPositions } = computeLedger(fromDbRows(rows));
    expect(openPositions[0].qty).toBe(10);
  });
});

describe("findNegativeQtyAfter (new-transaction guard)", () => {
  it("blocks an over-sell", () => {
    const existing = [tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500)];
    const candidate = tx(2, "2025-02-01", "Sell", "VOO", "US", 11, 600);
    expect(findNegativeQtyAfter(existing, candidate)).toBeCloseTo(-1, 6);
  });

  it("allows a sell within holdings", () => {
    const existing = [tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500)];
    const candidate = tx(2, "2025-02-01", "Sell", "VOO", "US", 10, 600);
    expect(findNegativeQtyAfter(existing, candidate)).toBeNull();
  });

  it("rejects a sell dated before its buy — replay is chronological, not insertion order", () => {
    // The sell is dated BEFORE the existing buy, so in the replayed
    // ledger it executes first and the position goes negative — even
    // though the final position after both rows would be positive.
    // This is the correct behavior: you can't sell what you don't hold.
    const existing = [tx(1, "2025-02-01", "Buy", "VOO", "US", 10, 500)];
    const candidate = tx(2, "2025-01-01", "Sell", "VOO", "US", 5, 600);
    expect(findNegativeQtyAfter(existing, candidate)).toBeCloseTo(-5, 6);
  });
});

describe("findFirstNegativeQty (edit guard)", () => {
  it("catches a later sell pushed negative by an edited buy", () => {
    const txns = [
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-02-01", "Sell", "VOO", "US", 10, 600),
    ];
    // Edit the buy down to 5 — the 10-share sell now goes negative.
    expect(findFirstNegativeQty([tx(1, "2025-01-01", "Buy", "VOO", "US", 5, 500), txns[1]])).toEqual({
      region: "US",
      ticker: "VOO",
      runningQty: -5,
    });
  });

  it("returns null when everything is consistent", () => {
    const txns = [
      tx(1, "2025-01-01", "Buy", "VOO", "US", 10, 500),
      tx(2, "2025-02-01", "Sell", "VOO", "US", 10, 600),
    ];
    expect(findFirstNegativeQty(txns)).toBeNull();
  });
});

describe("withLivePrices", () => {
  it("uses the compound region::ticker key", () => {
    const positions = [
      { region: "US", ticker: "VOO", qty: 10, avgCost: 500, heldSince: new Date("2025-01-01") },
      { region: "SG", ticker: "VOO", qty: 5, avgCost: 40, heldSince: new Date("2025-01-01") },
    ];
    const rows = withLivePrices(positions, { "US::VOO": 550, "SG::VOO": 44 });
    expect(rows[0].currentPrice).toBe(550);
    expect(rows[1].currentPrice).toBe(44);
  });

  it("falls back to cost basis and flags unavailability when no quote exists", () => {
    const positions = [
      { region: "HK", ticker: "0700", qty: 10, avgCost: 300, heldSince: new Date("2025-01-01") },
    ];
    const rows = withLivePrices(positions, {});
    expect(rows[0].currentPrice).toBe(300);
    expect(rows[0].totalHoldings).toBe(3000);
    expect(rows[0].unrealizedPL).toBe(0);
    expect(rows[0].priceUnavailable).toBe(true);
  });
});
