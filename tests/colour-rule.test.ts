// The colour rule's other half, as a test: colour is never the only signal.
//
// `docs/DESIGN.md` §2 — colour means up or down, and a figure that carries a
// direction also carries its sign. Every loss is signed wherever it appears,
// every return (`Percent`) is signed in both directions, and every P/L figure
// the app renders is signed, because a gain that reads as a bare value in green
// is exactly what a colour-blind reader, a printed page and a monochrome
// screenshot all lose.
//
// The file has two halves, and they fail for different reasons:
//
//   1. What the formatters guarantee, asserted by RENDERING them. These are
//      contracts, so a change to `SignedNumber.tsx` has to be deliberate.
//   2. That every P/L CALL SITE keeps passing `showPlus`. This is the mistake
//      the file exists to catch, and it has happened: the per-row unrealized
//      P/L and the realized-total stat both rendered a colour with no sign while
//      fifteen other P/L sites were signed, so the same figure read two ways
//      depending on which page you were on.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import {
  Money,
  NativeMoney,
  Percent,
  PlainMoney,
  PlainPercent,
} from "@/components/SignedNumber";

const render = (element: ReactElement) => renderToStaticMarkup(element);

describe("a return is signed in both directions", () => {
  it("Percent signs a gain, a loss, and a flat zero", () => {
    expect(render(Percent({ value: 0.1234 }))).toContain("+12.34%");
    expect(render(Percent({ value: -0.05 }))).toContain("-5.00%");
    // Zero is signed too. It is a return that happens to be flat, and the
    // column then reads as a column of returns rather than of blanks.
    expect(render(Percent({ value: 0 }))).toContain("+0.00%");
  });

  it("colours it by direction, and the neutral case carries neither colour", () => {
    expect(render(Percent({ value: 0.01 }))).toContain("text-gain");
    expect(render(Percent({ value: -0.01 }))).toContain("text-loss");
    expect(render(Percent({ value: 0 }))).toContain("text-ink-100");
  });
});

describe("money that is a RESULT carries its sign", () => {
  it("NativeMoney with showPlus signs a gain, with the sign before the symbol", () => {
    const gain = render(NativeMoney({ value: 1234.5, symbol: "S$", showPlus: true }));
    expect(gain).toContain("+S$1,234.50");
    expect(gain).toContain("text-gain");
  });

  it("a loss is signed whether or not showPlus is set", () => {
    // showPlus only ever ADDS the plus. A loss never depends on a prop to be
    // readable as a loss, which is what makes the opt-in safe.
    for (const showPlus of [true, false]) {
      const loss = render(NativeMoney({ value: -1234.5, symbol: "S$", showPlus }));
      expect(loss).toContain("-S$1,234.50");
      expect(loss).toContain("text-loss");
    }
  });

  it("signs a zero neither way, and leaves it neutral", () => {
    const zero = render(NativeMoney({ value: 0, symbol: "S$", showPlus: true }));
    expect(zero).toContain("S$0.00");
    expect(zero).not.toContain("+");
    expect(zero).toContain("text-ink-100");
  });

  it("Money colours by direction and signs only the loss", () => {
    // The coloured-but-unsigned component. Nothing renders it today — P/L goes
    // through NativeMoney with showPlus, and shares of a total through
    // PlainPercent — so this pins the exported API rather than a screen.
    // It is asserted deliberately: adopting `Money` for a gain and expecting a
    // "+" would be wrong, and that is worth failing a test over.
    const gain = render(Money({ value: 12.5 }));
    expect(gain).toContain("text-gain");
    expect(gain).not.toContain("+");
    expect(render(Money({ value: -12.5 }))).toContain("-$12.50");
    expect(render(Money({ value: 0 }))).toContain("text-ink-100");
  });
});

describe("money that is a VALUE carries no sign and no colour", () => {
  it("PlainMoney renders no plus, no colour, and the MAGNITUDE of a negative", () => {
    const value = render(PlainMoney({ value: 1234.5, symbol: "S$" }));
    expect(value).toContain("S$1,234.50");
    expect(value).not.toContain("+");
    expect(value).not.toContain("text-gain");
    expect(value).not.toContain("text-loss");

    // The hazard, pinned on purpose: hand a loss to PlainMoney and the minus
    // disappears, because this component is for quantities — a total, a cost
    // basis, a holding's value, a cash balance — and never for a result.
    const negative = render(PlainMoney({ value: -1234.5, symbol: "S$" }));
    expect(negative).toContain("S$1,234.50");
    expect(negative).not.toContain("-");
  });

  it("PlainPercent renders no plus and no colour", () => {
    const share = render(PlainPercent({ value: 0.3136 }));
    expect(share).toContain("31.36%");
    expect(share).not.toContain("+");
    expect(share).not.toContain("text-gain");
    expect(share).not.toContain("text-loss");
  });
});

/** Every `.tsx` under `components/` and `app/`, so the scan follows the app as
 *  it grows rather than a hand-kept list of files. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function tsxSources(): Array<{ file: string; source: string }> {
  const found: Array<{ file: string; source: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) {
        found.push({
          file: path.slice(ROOT.length).replace(/\\/g, "/"),
          source: readFileSync(path, "utf8"),
        });
      }
    }
  };
  for (const dir of ["components", "app"]) walk(join(ROOT, dir));
  return found;
}

/** One JSX tag of a money formatter, however it is wrapped. The tags do not
 *  nest, so this needs no JSX parser — but it does stop at the first `>`, which
 *  is why the "did the scan find anything" test below exists. The negated
 *  character classes cross line breaks on their own, so no `s` flag is needed
 *  (and the project targets ES2017, where `s` is not available). */
const MONEY_TAG = /<(?:Native|Plain)?Money\b[^>]*?\/?>/g;

/** The tag's value expression, when it is a plain `value={...}`. */
const VALUE_EXPR = /value=\{([^}]*)\}/;

/** A P/L-shaped identifier. The convention here is an `PL` inside the name —
 *  `unrealizedPL`, `realizedPLSGD`, `totalPLConverted` — so this is a
 *  convention check, not a type check: a P/L figure named some other way would
 *  slip past it. The formatter contracts above are the part that holds no
 *  matter how a call site names its variable. */
const PL_NAME = /\b\w*PL\w*\b/;

const MONEY_SITES = tsxSources().flatMap(({ file, source }) =>
  Array.from(source.matchAll(MONEY_TAG)).map((match) => ({ file, tag: match[0] }))
);

describe("every P/L figure on screen is signed", () => {
  it("finds the money formatters at all — a scan that matches nothing proves nothing", () => {
    expect(MONEY_SITES.length).toBeGreaterThan(20);
  });

  it("passes showPlus wherever the figure is a P/L", () => {
    const unsigned = MONEY_SITES.filter(({ tag }) => {
      const expression = tag.match(VALUE_EXPR)?.[1] ?? "";
      return PL_NAME.test(expression) && !tag.includes("showPlus");
    });

    expect(
      unsigned.map(({ file, tag }) => `${file}: ${tag.replace(/\s+/g, " ").trim()}`),
      "a P/L figure is rendered with a colour and no sign — give it `showPlus`"
    ).toEqual([]);
  });

  it("leaves figures that are not P/L unsigned — the trigger stays narrow", () => {
    // The guard on the guard. `showPlus` is opt-in by design (a price, a cost
    // basis and a cash balance are quantities and take no plus), so a scan that
    // flagged every money tag would be worthless; this pins that the two
    // populations really are separate.
    const signed = MONEY_SITES.filter(({ tag }) => tag.includes("showPlus"));
    expect(signed.length).toBeGreaterThan(10);
    expect(signed.length).toBeLessThan(MONEY_SITES.length);
  });
});
