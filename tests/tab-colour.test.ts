// The tab strip's contrast, as a test.
//
// The section strip's icons used to carry `text-ink-500` of their own, on the
// theory that a quiet grey was the right weight for a piece of decoration. It is
// not, and the arithmetic is the reason: the ACTIVE tab paints its label `ink-950`
// on the gold pill, and the icon kept its own grey — so the strip's icon measured
// **1.54:1** against the pill it sat on, while the label beside it measured 8.54:1.
// Under WCAG's non-text floor of 3:1 for a graphic, that is an icon nobody can
// see, and it was reported as exactly that: "on the sub tabs, the icons don't pass
// colour contrast standards".
//
// The fix is to give the icon no colour at all, so its `currentColor` stroke
// follows the tab. Two things then have to stay true, and this file is what keeps
// them true: the tab's own colours have to clear the floor in both states, and no
// section layout may hand an icon a colour class again. The second half is a
// source scan — the failure mode is a one-word className in a layout file, which
// no rendering test would catch.
//
// Contrast is computed here the same way `tests/design-tokens.test.ts` does it,
// and the tokens are imported from the live config rather than copied, so this
// cannot pass against a palette the app no longer ships.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import config from "@/tailwind.config";

const colors = (
  config as unknown as { theme: { extend: { colors: { ink: Record<string, string>; accent: string } } } }
).theme.extend.colors;

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Non-text graphics and UI boundaries need 3:1; the strip's labels are text and
 *  are held to 4.5:1 — the stricter of the two is what the icons must clear
 *  because they sit inside a control that is read as a unit. */
const GRAPHIC = 3;
const AA_TEXT = 4.5;

describe("a tab's colours, in both states", () => {
  it("an icon at rest (ink-300) clears text contrast on the page", () => {
    expect(round2(contrast(colors.ink["300"], colors.ink["950"]))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("an icon and a label on the gold pill (ink-950 on accent) clear it with room", () => {
    const ratio = contrast(colors.ink["950"], colors.accent);
    expect(round2(ratio)).toBe(8.54);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the colour an icon used to carry on that pill FAILS, which is why it may not carry one", () => {
    // The regression this file exists for, kept as arithmetic rather than as a
    // comment: ink-500 on the gold is not "a bit quiet", it is 1.54:1 — an icon
    // that has, in practice, disappeared. If someone later decides the icons
    // SHOULD have their own colour, this test says which colour not to pick.
    const stale = contrast(colors.ink["500"], colors.accent);
    expect(round2(stale)).toBe(1.54);
    expect(stale).toBeLessThan(GRAPHIC);
  });
});

describe("no section tab hands its icon a colour", () => {
  /** Every section layout under app/ — the files that can render a SectionTabs
   *  strip. Only the ones that exist: not every route group has a layout, and the
   *  directories without one are simply not part of the scan. */
  const layouts = readdirSync(fileURLToPath(new URL("../app", import.meta.url)), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(entry.name, "layout.tsx"))
    .filter((relative) =>
      existsSync(fileURLToPath(new URL(`../app/${relative}`, import.meta.url)))
    );

  it("finds the layouts to scan, so a silent empty scan cannot pass", () => {
    const withIcons = layouts.filter((relative) => {
      const source = readFileSync(fileURLToPath(new URL(`../app/${relative}`, import.meta.url)), "utf8");
      return source.includes("icon:");
    });
    expect(withIcons.length).toBeGreaterThanOrEqual(3);
  });

  for (const relative of layouts) {
    const path = new URL(`../app/${relative}`, import.meta.url);
    const source = readFileSync(fileURLToPath(path), "utf8");
    if (!source.includes("icon:")) continue;

    it(`${relative} passes bare icons into its tabs`, () => {
      // A `text-*` class inside an `icon:` element is the mistake. Matched across
      // the element rather than per line, because a lucide icon is written on one
      // line and an icon given a colour is therefore impossible to write
      // differently.
      const offenders = source
        .split(/\r?\n/)
        .map((line, index) => ({ line: line.trim(), at: index + 1 }))
        .filter(({ line }) => line.startsWith("icon:") && /className="[^"]*\btext-/.test(line));

      expect(
        offenders,
        `give the tab its colour and let the icon inherit it — ${offenders
          .map((o) => `line ${o.at}: ${o.line}`)
          .join("; ")}`
      ).toEqual([]);
    });
  }
});
