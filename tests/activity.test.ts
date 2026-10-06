import { describe, expect, it } from "vitest";
import { buildActivityTimeline, filterActivityTimeline, type ActivityInputs } from "@/lib/activity";

function inputs(): ActivityInputs {
  return {
    transactions: [
      { id: 1, date: new Date("2026-05-05T00:00:00.000Z"), action: "Buy", ticker: "VOO", region: "US", qty: 2, price: 500 },
      { id: 2, date: new Date("2026-05-07T00:00:00.000Z"), action: "Sell", ticker: "VOO", region: "US", qty: 1, price: 510 },
    ],
    contributions: [
      { id: 3, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 1000, contributor: { name: "Alex" } },
      { id: 4, date: new Date("2026-04-01T00:00:00.000Z"), paidOn: null, label: "APR (2026)", amount: 900, contributor: { name: "Bo" } },
    ],
    exchanges: [
      { id: 5, date: new Date("2026-05-08T12:30:00.000Z"), fromCurrency: "SGD", fromAmount: 1000, toCurrency: "USD", toAmount: 740, rate: 0.74, auto: false },
    ],
  };
}

describe("buildActivityTimeline", () => {
  it("merges all three existing ledgers newest first and uses deposit arrival dates when known", () => {
    const events = buildActivityTimeline(inputs());
    expect(events.map((event) => event.id)).toEqual([
      "exchange:5",
      "trade:2",
      "deposit:3",
      "trade:1",
      "deposit:4",
    ]);
    const arrivedDeposit = events.find((event) => event.id === "deposit:3");
    expect(arrivedDeposit).toMatchObject({ kind: "deposit", arrivalDateUnknown: false });
    expect(arrivedDeposit?.date.toISOString()).toBe("2026-05-06T00:00:00.000Z");
  });

  it("orders same-day records by their numeric source id rather than string id", () => {
    const sameDay = new Date("2026-06-01T00:00:00.000Z");
    const events = buildActivityTimeline({
      transactions: [1, 10, 2].map((id) => ({
        id,
        date: sameDay,
        action: "Buy",
        ticker: `T${id}`,
        region: "US",
        qty: 1,
        price: 1,
      })),
      contributions: [],
      exchanges: [],
    });
    expect(events.map((event) => event.id)).toEqual(["trade:1", "trade:2", "trade:10"]);
  });

  it("marks an unknown arrival and uses the attribution date only as the timeline anchor", () => {
    const event = buildActivityTimeline(inputs()).find((item) => item.id === "deposit:4");
    expect(event).toMatchObject({ kind: "deposit", arrivalDateUnknown: true, label: "APR (2026)" });
    expect(event?.date.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    if (event?.kind === "deposit") {
      expect(event.attributedDate.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    }
  });

  it("keeps every event when the feed is empty or mixed and does not edit ledger inputs", () => {
    const source = inputs();
    const before = structuredClone(source);
    expect(buildActivityTimeline({ transactions: [], contributions: [], exchanges: [] })).toEqual([]);
    expect(buildActivityTimeline(source)).toHaveLength(5);
    expect(source).toEqual(before);
  });
});

describe("filterActivityTimeline", () => {
  const events = buildActivityTimeline(inputs());

  it("returns all events in existing chronological order", () => {
    expect(filterActivityTimeline(events, "all")).toEqual(events);
  });

  it("keeps trades, deposits, and exchanges isolated in their corresponding views", () => {
    expect(filterActivityTimeline(events, "trades").map((event) => event.kind)).toEqual(["trade", "trade"]);
    expect(filterActivityTimeline(events, "deposits").map((event) => event.kind)).toEqual(["deposit", "deposit"]);
    expect(filterActivityTimeline(events, "exchanges").map((event) => event.kind)).toEqual(["exchange"]);
  });
});
