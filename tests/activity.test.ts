import { describe, expect, it } from "vitest";
import {
  buildActivityTimeline,
  filterActivityByDateRange,
  filterActivityTimeline,
  type ActivityInputs,
} from "@/lib/activity";

function inputs(): ActivityInputs {
  return {
    transactions: [
      { id: 1, date: new Date("2026-05-05T00:00:00.000Z"), action: "Buy", ticker: "VOO", region: "US", qty: 2, price: 500 },
      { id: 2, date: new Date("2026-05-07T00:00:00.000Z"), action: "Sell", ticker: "VOO", region: "US", qty: 1, price: 510 },
    ],
    contributions: [
      { id: 3, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 600, contributor: { name: "Alex" } },
      { id: 4, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T13:00:00.000Z"), label: "MAY (2026)", amount: 400, contributor: { name: "Bo" } },
      { id: 6, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 200, contributor: { name: "Alex" } },
      { id: 8, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 200, contributor: { name: "Chin" } },
      { id: 9, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 500, contributor: { name: "Keng" } },
      { id: 10, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: new Date("2026-05-06T00:00:00.000Z"), label: "MAY (2026)", amount: 500, contributor: { name: "Roy" } },
      { id: 7, date: new Date("2026-05-01T00:00:00.000Z"), paidOn: null, label: "MAY (2026)", amount: 50, contributor: { name: "Cy" } },
      { id: 5, date: new Date("2026-04-01T00:00:00.000Z"), paidOn: null, label: "APR (2026)", amount: 900, contributor: { name: "Bo" } },
    ],
    exchanges: [
      { id: 5, date: new Date("2026-05-08T12:30:00.000Z"), fromCurrency: "SGD", fromAmount: 1000, toCurrency: "USD", toAmount: 740, rate: 0.74, auto: false },
    ],
  };
}

describe("buildActivityTimeline", () => {
  it("merges the ledgers newest first and groups same-calendar-day deposits by arrival date", () => {
    const events = buildActivityTimeline(inputs());
    expect(events.map((event) => event.id)).toEqual([
      "exchange:5",
      "trade:2",
      "deposit:2026-05-06",
      "trade:1",
      "deposit:2026-05-01",
      "deposit:2026-04-01",
    ]);
    const arrivedDeposit = events.find((event) => event.id === "deposit:2026-05-06");
    expect(arrivedDeposit).toMatchObject({
      kind: "deposit",
      arrivalDateStatus: "known",
      labels: ["MAY (2026)"],
      contributors: [
        { name: "Alex", amount: 800 },
        { name: "Bo", amount: 400 },
        { name: "Chin", amount: 200 },
        { name: "Keng", amount: 500 },
        { name: "Roy", amount: 500 },
      ],
      amount: 2400,
    });
    expect(arrivedDeposit?.date.toISOString()).toBe("2026-05-06T00:00:00.000Z");
  });

  it("orders same-day trade records by their numeric source id rather than string id", () => {
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

  it("groups multiple deposit batches and contributor amounts on the same effective date", () => {
    const base = inputs();
    const twoLabels: ActivityInputs = {
      transactions: [],
      exchanges: [],
      contributions: [
        { ...base.contributions[0], label: "MAY (2026)" },
        { ...base.contributions[1], label: "BONUS", paidOn: new Date("2026-05-06T23:00:00.000Z") },
      ],
    };
    const deposits = buildActivityTimeline(twoLabels);
    expect(deposits).toHaveLength(1);
    expect(deposits[0]).toMatchObject({
      labels: ["BONUS", "MAY (2026)"],
      contributors: [{ name: "Alex", amount: 600 }, { name: "Bo", amount: 400 }],
      amount: 1000,
    });
  });

  it("marks a grouped deposit mixed when only some stakeholder arrival dates are recorded", () => {
    const source = inputs();
    source.contributions.push({
      id: 11,
      date: new Date("2026-05-06T00:00:00.000Z"),
      paidOn: null,
      label: "MAY (2026)",
      amount: 50,
      contributor: { name: "Cy" },
    });
    const deposit = buildActivityTimeline(source).find((event) => event.id === "deposit:2026-05-06");
    expect(deposit).toMatchObject({ kind: "deposit", arrivalDateStatus: "mixed" });
  });

  it("marks deposits without a recorded arrival date and uses attribution date as their anchor", () => {
    const event = buildActivityTimeline(inputs()).find((item) => item.id === "deposit:2026-04-01");
    expect(event).toMatchObject({
      kind: "deposit",
      arrivalDateStatus: "unknown",
      labels: ["APR (2026)"],
      contributors: [{ name: "Bo", amount: 900 }],
    });
    expect(event?.date.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("does not mutate source ledgers and supports an empty feed", () => {
    const source = inputs();
    const before = structuredClone(source);
    expect(buildActivityTimeline({ transactions: [], contributions: [], exchanges: [] })).toEqual([]);
    expect(buildActivityTimeline(source)).toHaveLength(6);
    expect(source).toEqual(before);
  });
});

describe("activity filters", () => {
  const events = buildActivityTimeline(inputs());

  it("filters trades, grouped deposits, and exchanges independently", () => {
    expect(filterActivityTimeline(events, "all")).toEqual(events);
    expect(filterActivityTimeline(events, "trades").map((event) => event.kind)).toEqual(["trade", "trade"]);
    expect(filterActivityTimeline(events, "deposits").map((event) => event.kind)).toEqual(["deposit", "deposit", "deposit"]);
    expect(filterActivityTimeline(events, "exchanges").map((event) => event.kind)).toEqual(["exchange"]);
  });
});

describe("filterActivityByDateRange", () => {
  const events = buildActivityTimeline(inputs());
  const now = new Date("2026-05-08T18:00:00.000Z");

  it("includes both boundary calendar dates for custom ranges", () => {
    expect(filterActivityByDateRange(events, "custom", { from: "2026-05-06", to: "2026-05-07" }, now).map((event) => event.id)).toEqual([
      "trade:2",
      "deposit:2026-05-06",
    ]);
  });

  it("includes today and the preceding six calendar days in the 7-day preset", () => {
    expect(filterActivityByDateRange(events, "7days", { from: "", to: "" }, now).map((event) => event.id)).toEqual([
      "exchange:5",
      "trade:2",
      "deposit:2026-05-06",
      "trade:1",
    ]);
  });

  it("supports open custom endpoints and returns no rows for invalid or reversed dates", () => {
    expect(filterActivityByDateRange(events, "custom", { from: "2026-05-07", to: "" }, now).map((event) => event.id)).toEqual(["exchange:5", "trade:2"]);
    expect(filterActivityByDateRange(events, "custom", { from: "2026-02-30", to: "" }, now)).toEqual([]);
    expect(filterActivityByDateRange(events, "custom", { from: "2026-05-08", to: "2026-05-01" }, now)).toEqual([]);
  });

  it("uses inclusive rolling boundaries for 30-day and 90-day presets", () => {
    expect(filterActivityByDateRange(events, "30days", { from: "", to: "" }, now)).toHaveLength(5);
    expect(filterActivityByDateRange(events, "90days", { from: "", to: "" }, now)).toHaveLength(6);
  });

  it("keeps all events in the All dates range", () => {
    expect(filterActivityByDateRange(events, "all", { from: "", to: "" }, now)).toEqual(events);
  });
});
