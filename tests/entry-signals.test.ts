import { describe, it, expect } from "vitest";
import {
  sma,
  rsiWilder,
  rsiZone,
  entrySignals,
  parseSignalKeys,
  MIN_SESSIONS,
} from "@/lib/entry-signals";

/** A year of sessions, rising then dipping — what a real series looks like
 *  after a good run and a pullback. */
function risingThenDipping() {
  const rising = Array.from({ length: 200 }, (_, i) => 100 + i); // 100..299
  const dipping = Array.from({ length: 50 }, (_, i) => 299 - i); // 299..250
  return [...rising, ...dipping];
}

describe("sma", () => {
  it("averages the LAST n values, not the first", () => {
    expect(sma([1, 2, 3, 4, 5], 2)).toBe(4.5);
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
  });

  it("answers null rather than averaging what it has", () => {
    // A 200-day average from 30 sessions is not a 200-day average, and a
    // shorter one would quietly mislabel the trend.
    expect(sma([1, 2, 3], 4)).toBeNull();
    expect(sma([], 1)).toBeNull();
    expect(sma([1, 2], 0)).toBeNull();
  });
});

describe("rsiWilder", () => {
  it("uses Wilder smoothing, not a plain mean of gains and losses", () => {
    // Three changes (+1, -1, +1) seed avgGain 2/3 and avgLoss 1/3; the fourth
    // change (-1) smooths to 4/9 and 5/9, giving RS 0.8 and RSI 44.444.
    // A simple average of all four changes is 2/4 vs 2/4, i.e. exactly 50 —
    // so this number is what proves the smoothing is the real one.
    expect(rsiWilder([10, 11, 10, 11, 10], 3)).toBeCloseTo(44.4444, 3);
  });

  it("reads 100 when nothing ever falls, and 0 when nothing ever rises", () => {
    expect(rsiWilder(Array.from({ length: 30 }, (_, i) => 100 + i))).toBe(100);
    expect(rsiWilder(Array.from({ length: 30 }, (_, i) => 200 - i))).toBe(0);
  });

  it("reads 50 for a series that never moves", () => {
    // No gain and no loss is not a division by zero, and not a sell signal.
    expect(rsiWilder(Array.from({ length: 30 }, () => 12))).toBe(50);
  });

  it("needs period + 1 closes", () => {
    expect(rsiWilder(Array.from({ length: 14 }, (_, i) => i))).toBeNull();
    expect(rsiWilder(Array.from({ length: 15 }, (_, i) => i))).not.toBeNull();
  });

  it("stays inside 0..100 on a noisy series", () => {
    const noisy = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i) * 8 + (i % 7));
    const value = rsiWilder(noisy);
    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(0);
    expect(value!).toBeLessThanOrEqual(100);
  });
});

describe("rsiZone", () => {
  it("maps the conventional bands to words", () => {
    expect(rsiZone(12)).toBe("oversold");
    expect(rsiZone(30)).toBe("oversold");
    expect(rsiZone(44.4)).toBe("neutral");
    expect(rsiZone(70)).toBe("overbought");
    expect(rsiZone(88)).toBe("overbought");
    expect(rsiZone(null)).toBeNull();
  });
});

describe("entrySignals", () => {
  it("refuses to read a series that is too short, and says how short", () => {
    const signals = entrySignals(Array.from({ length: 40 }, (_, i) => 100 + i));
    expect(signals.sessions).toBe(40);
    expect(signals.rangeLow).toBeNull();
    expect(signals.rsi14).toBeNull();
    expect(signals.sma200).toBeNull();
    expect(signals.trend).toBeNull();
  });

  it("places a rising series at the top of its year", () => {
    const signals = entrySignals(Array.from({ length: 250 }, (_, i) => 100 + i));
    expect(signals.sessions).toBe(250);
    expect(signals.rangeLow).toBe(100);
    expect(signals.rangeHigh).toBe(349);
    expect(signals.rangePosition).toBeCloseTo(1, 6);
    expect(signals.pctBelowHigh).toBeCloseTo(0, 6);
    expect(signals.rsi14).toBe(100);
    expect(signals.trend).toBe("up");
  });

  it("places a falling series at the bottom, and calls the trend down", () => {
    const signals = entrySignals(Array.from({ length: 250 }, (_, i) => 349 - i));
    expect(signals.rangeLow).toBe(100);
    expect(signals.rangeHigh).toBe(349);
    expect(signals.rangePosition).toBeCloseTo(0, 6);
    // 249 below 349 is 71.3% off the high.
    expect(signals.pctBelowHigh).toBeCloseTo(249 / 349, 6);
    expect(signals.rsi14).toBe(0);
    expect(signals.trend).toBe("down");
  });

  it("says Mixed when the averages disagree, because that is the real answer", () => {
    // Rises all year, then gives back the last 50 sessions. A price below its
    // 50-day while the 50-day is above the 200-day is neither an uptrend nor a
    // downtrend, and inventing one would be worse than saying so.
    const signals = entrySignals(risingThenDipping());
    expect(signals.sessions).toBe(250);
    expect(signals.trend).toBe("mixed");
    expect(signals.vs50!).toBeLessThan(0);
    expect(signals.vs200!).toBeGreaterThan(0);
    expect(signals.rangePosition).toBeCloseTo(150 / 199, 6);
  });

  it("ignores values that are not numbers instead of poisoning the average", () => {
    const clean = Array.from({ length: 250 }, (_, i) => 100 + i);
    const withGaps = [...clean.slice(0, 249), Number.NaN, ...clean.slice(249)];
    const signals = entrySignals(withGaps);
    expect(signals.sessions).toBe(250);
    expect(signals.rangeHigh).toBe(349);
  });

  it("needs exactly MIN_SESSIONS sessions before it answers", () => {
    const justShort = Array.from({ length: MIN_SESSIONS - 1 }, (_, i) => 100 + i);
    expect(entrySignals(justShort).trend).toBeNull();
    expect(entrySignals([...justShort, 400]).trend).not.toBeNull();
  });
});

describe("parseSignalKeys", () => {
  it("accepts the compound key the response is keyed by", () => {
    expect(parseSignalKeys("US::XLV,SG::D05")).toEqual([
      { region: "US", ticker: "XLV" },
      { region: "SG", ticker: "D05" },
    ]);
  });

  it("still accepts a single colon, so an older caller cannot silently send nothing", () => {
    expect(parseSignalKeys("US:XLV")).toEqual([{ region: "US", ticker: "XLV" }]);
  });

  it("drops half-formed keys and caps the work one query can ask for", () => {
    expect(parseSignalKeys("US::XLV,garbage,::")).toEqual([{ region: "US", ticker: "XLV" }]);
    const many = Array.from({ length: 90 }, (_, i) => `US::T${i}`).join(",");
    expect(parseSignalKeys(many)).toHaveLength(60);
    expect(parseSignalKeys(many, 3)).toHaveLength(3);
  });
});
