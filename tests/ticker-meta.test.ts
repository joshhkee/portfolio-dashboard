import { describe, it, expect } from "vitest";
import { mergeMeta } from "@/lib/ticker-meta";
import type { QuoteMeta } from "@/lib/prices";

function quote(over: Partial<QuoteMeta> = {}): QuoteMeta {
  return {
    price: 100,
    name: "Auto Fetched Name",
    instrumentType: "EQUITY",
    exchange: "NYSEArca",
    currency: "USD",
    ...over,
  };
}

describe("mergeMeta", () => {
  it("uses the fetched name on a first sighting", () => {
    const merged = mergeMeta(null, quote());
    expect(merged.name).toBe("Auto Fetched Name");
    expect(merged.nameOverridden).toBe(false);
    expect(merged.instrumentType).toBe("EQUITY");
    expect(merged.exchange).toBe("NYSEArca");
    expect(merged.currency).toBe("USD");
  });

  it("NEVER overwrites a hand-edited name", () => {
    // The whole point of the override: a background refresh must not
    // silently revert the owner's correction.
    const merged = mergeMeta(
      { name: "Procter & Gamble", nameOverridden: true },
      quote({ name: "Proctor & Gamble" })
    );
    expect(merged.name).toBe("Procter & Gamble");
    expect(merged.nameOverridden).toBe(true);
  });

  it("still refreshes the non-name fields when the name is overridden", () => {
    const merged = mergeMeta(
      { name: "My Name", nameOverridden: true },
      quote({ instrumentType: "ETF", exchange: "NYSEArca", currency: "USD" })
    );
    expect(merged.instrumentType).toBe("ETF");
    expect(merged.exchange).toBe("NYSEArca");
  });

  it("keeps the previous name when a fetch returns no name", () => {
    // Transient failures shouldn't blank out a good cached name.
    const merged = mergeMeta(
      { name: "Vanguard S&P 500 ETF", nameOverridden: false },
      quote({ name: null })
    );
    expect(merged.name).toBe("Vanguard S&P 500 ETF");
  });

  it("updates a previously auto-filled name when a better one arrives", () => {
    const merged = mergeMeta(
      { name: "VOO", nameOverridden: false },
      quote({ name: "Vanguard S&P 500 ETF" })
    );
    expect(merged.name).toBe("Vanguard S&P 500 ETF");
  });

  it("stays null when neither source has a name (e.g. an FX pair)", () => {
    const merged = mergeMeta(null, quote({ name: null }));
    expect(merged.name).toBeNull();
    expect(merged.nameOverridden).toBe(false);
  });
});
