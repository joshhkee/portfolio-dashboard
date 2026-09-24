// The design system's measured claims, as tests.
//
// Every number below is stated in `docs/DESIGN.md` §2, and each one is the
// REASON a colour has the value it has: `ink-500` is #8f8b85 because #6b6862
// measured 3.04–3.37:1 and failed AA for the small text it carries in 17
// places, and `loss` is #c07f74 because #b06d64 measured 4.32:1 on panels. A
// palette change that breaks one of those claims now fails here, beside the
// rule it breaks, instead of waiting to be noticed on a page — which is the
// failure mode the original contrast pass existed to fix.
//
// The tokens are imported from `tailwind.config.ts` rather than copied, so this
// test cannot pass against a palette the app no longer ships.
//
// Not covered here: whether two `data` colours are distinguishable to a reader
// with colour vision deficiency. That needs a perceptual metric rather than a
// contrast ratio, and the app leans on dash patterns and stroke weights for
// that instead of on this file.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import config from "@/tailwind.config";

interface Palette {
  ink: Record<string, string>;
  gain: string;
  gainBg: string;
  loss: string;
  lossBg: string;
  accent: string;
  accentHover: string;
  accentMuted: string;
  data: Record<string, string>;
}

const colors = (config as unknown as { theme: { extend: { colors: Palette } } }).theme.extend.colors;

/** Every surface a token lands on, darkest to lightest, by their key under
 *  `colors.ink`. `800` — modals and hover states — is the worst case, and the
 *  one that decides a value. */
const SURFACES = ["950", "900", "850", "800"] as const;

/** AA for the small text these tokens are used for. */
const AA_TEXT = 4.5;
/** Non-text graphics — a chart line, a reference line — need 3:1, not 4.5:1. */
const AA_GRAPHIC = 3;
/** The stricter floor the design notes quote for the multi-series palette. */
const DATA_FLOOR = 5.7;

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio, 1..21, order-independent. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The notes quote two decimals, so compare at that precision: 5.53 means
 *  5.53, not 5.5296 rounding its way past a threshold. */
const round2 = (n: number) => Math.round(n * 100) / 100;

const TEXT_TOKENS: Array<[string, string]> = [
  ["ink-100", colors.ink["100"]],
  ["ink-300", colors.ink["300"]],
  ["ink-500", colors.ink["500"]],
  ["accent", colors.accent],
  ["gain", colors.gain],
  ["loss", colors.loss],
];

describe("every text colour clears AA on every surface it lands on", () => {
  for (const [name, hex] of TEXT_TOKENS) {
    it(`${name} clears ${AA_TEXT}:1 on all four backgrounds`, () => {
      for (const surface of SURFACES) {
        const ratio = contrast(hex, colors.ink[surface]);
        expect(
          ratio,
          `${name} (${hex}) on ink-${surface} measured ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  it("the badge washes clear it too — a gain on gainBg, a loss on lossBg", () => {
    expect(contrast(colors.gain, colors.gainBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.loss, colors.lossBg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the modal is the tightest background for ink-500, which is why it decided the value", () => {
    // Not a curiosity: the first candidate for this token (#8a8680) passed on
    // the page and failed on the modal, so the rule is "pick against the worst
    // case". If this ever fails, a surface changed and the value must be
    // re-chosen rather than the test relaxed.
    const ratios = SURFACES.map((surface) => contrast(colors.ink["500"], colors.ink[surface]));
    const tightest = SURFACES[ratios.indexOf(Math.min(...ratios))];
    expect(`ink-${tightest}`).toBe("ink-800");
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the numbers docs/DESIGN.md quotes are still the numbers", () => {
  it("ink-500 measures 5.53 on the page, 5.14 on a panel and 4.75 on a modal", () => {
    expect(round2(contrast(colors.ink["500"], colors.ink["950"]))).toBe(5.53);
    expect(round2(contrast(colors.ink["500"], colors.ink["900"]))).toBe(5.14);
    expect(round2(contrast(colors.ink["500"], colors.ink["800"]))).toBe(4.75);
  });

  it("accent measures 8.54 on the page, 7.93 on a panel and 6.19 against a gridline", () => {
    expect(round2(contrast(colors.accent, colors.ink["950"]))).toBe(8.54);
    expect(round2(contrast(colors.accent, colors.ink["900"]))).toBe(7.93);
    expect(round2(contrast(colors.accent, colors.ink["700"]))).toBe(6.19);
  });

  it("loss clears 5:1 on a panel and on its own badge wash", () => {
    expect(contrast(colors.loss, colors.ink["950"])).toBeGreaterThanOrEqual(5);
    expect(contrast(colors.loss, colors.lossBg)).toBeGreaterThanOrEqual(5);
  });

  it("every data colour clears the quoted floor on the page background", () => {
    for (const [name, hex] of Object.entries(colors.data)) {
      const ratio = contrast(hex, colors.ink["950"]);
      expect(
        ratio,
        `data.${name} measured ${ratio.toFixed(2)}:1; the notes claim >= ${DATA_FLOOR}`
      ).toBeGreaterThanOrEqual(DATA_FLOOR);
    }
  });
});

describe("the data palette extends the semantic colours rather than duplicating them", () => {
  it("data.sage IS gain and data.terracotta IS loss", () => {
    // One intent, one value: a gain must not read as one green in a table and a
    // slightly different green in a chart. Changing `gain` therefore changes the
    // charts too — which is the point, not a side effect.
    expect(colors.data.sage).toBe(colors.gain);
    expect(colors.data.terracotta).toBe(colors.loss);
  });

  it("data.gold is deliberately NOT the chrome gold", () => {
    // `accent` stays the brand/interactive colour and the single-series line;
    // multi-series data draws from the desaturated cousin.
    expect(colors.data.gold).not.toBe(colors.accent);
  });
});

describe("the chart colours that are literals, not tokens", () => {
  const chart = readFileSync(
    fileURLToPath(new URL("../components/PortfolioValueChart.tsx", import.meta.url)),
    "utf8"
  );

  it("still draws the value series in the chrome gold", () => {
    expect(chart).toContain(colors.accent);
  });

  it("still draws the outlay reference line at #5f5c57, and it still separates from the gold", () => {
    // The reason this is a hex rather than `ink-500`: at #6b6862 the line
    // separated from the gold series by only 2.53:1, below the 3:1 non-text
    // floor. #5f5c57 lifts that to 3.03:1 while still receding into the page
    // (2.81:1), which is what a reference line should do.
    expect(chart).toContain("#5f5c57");
    expect(round2(contrast("#5f5c57", colors.accent))).toBe(3.03);
    expect(round2(contrast("#5f5c57", colors.ink["950"]))).toBe(2.81);
    expect(contrast("#5f5c57", colors.accent)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it("keeps the gridlines at ink-700, which the gold clears for graphics", () => {
    expect(chart).toContain(colors.ink["700"]);
    expect(contrast(colors.accent, colors.ink["700"])).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});
