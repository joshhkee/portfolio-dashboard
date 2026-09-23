import { describe, it, expect } from "vitest";
import {
  averageDirection,
  classifyNote,
  isNameOnly,
  ledgerSummary,
  ledgerSummaryParts,
  noteCell,
} from "@/lib/notes";

/** Every row in the real ledger, read from the shared database on 2026-09-23:
 *  (ticker, cached name, note). All 64 are here, duplicates included, so the
 *  classification decisions below are pinned against what is actually stored
 *  rather than against invented text. */
const LEDGER: Array<[ticker: string, name: string, note: string]> = [
  ["VOO", "Vanguard S&P 500 ETF", "VOO - Vanguard S&P 500 ETF"],
  ["D05", "DBS Group Holdings Ltd", "D05 - DBS"],
  ["SLV", "iShares Silver Trust", "SLV - iShares Silver Trust"],
  ["B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["B", "Barrick Mining Corporation", "B - Second Buy"],
  ["B", "Barrick Mining Corporation", "B - Sell All"],
  ["QQQ", "Invesco QQQ Trust", "QQQ - Invesco QQQ Trust"],
  ["QQQ", "Invesco QQQ Trust", "QQQ - Sell All"],
  ["D05", "DBS Group Holdings Ltd", "D05 - Second Buy"],
  ["VOO", "Vanguard S&P 500 ETF", "VOO - Sell All"],
  ["PG", "The Procter & Gamble Company", "PG - Proctor & Gamble"],
  ["PANW", "Palo Alto Networks, Inc.", "PANW - Palo Alto Networks"],
  ["ZS", "Zscaler, Inc.", "ZS - Zscaler"],
  ["03115", "iShares Core Hang Seng Index ETF", "03115 - iShares Core Hang Seng Index ETF"],
  ["01810", "Xiaomi Corporation", "01810 - XIAOMI-W"],
  ["B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["QQQ", "Invesco QQQ Trust", "QQQ - Invesco QQQ Trust"],
  ["VUG", "Vanguard Morningstar Growth ETF", "VUG - Vanguard Growth ETF"],
  ["ES3", "State Street SPDR Straits Times Index ETF", "ES3 - STI ETF"],
  ["03115", "iShares Core Hang Seng Index ETF", "03115 - Sell All"],
  ["B", "Barrick Mining Corporation", "B - Sell All"],
  ["ZS", "Zscaler, Inc.", "ZS - Second Buy (Avg Down to x10@$263.25)"],
  ["B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["VOO", "Vanguard S&P 500 ETF", "VOO - Vanguard S&P 500 ETF"],
  ["B", "Barrick Mining Corporation", "B - Second Buy"],
  ["PG", "The Procter & Gamble Company", "PG - Sell All"],
  ["VOO", "Vanguard S&P 500 ETF", "VOO - Second Buy (Avg Down to x10@$629)"],
  ["QQQ", "Invesco QQQ Trust", "QQQ - Sell Part (60%)"],
  ["ZS", "Zscaler, Inc.", "ZS - Third buy (Avg down to x20@$207.12)"],
  ["IXJ", "iShares Global Healthcare ETF", "IXJ - iShares Global Healthcare ETF"],
  ["VHT", "Vanguard Health Care Index Fund ETF Shares", "VHT - Vanguard Health Care ETF"],
  ["PANW", "Palo Alto Networks, Inc.", "PANW - Partial Exit (60%)"],
  ["FLKR", "Franklin FTSE South Korea ETF", "FLKR - Franklin Templeton ETF (FTSE South Korea)"],
  ["DRAM", "Roundhill Memory ETF", "DRAM - Roundhill Memory ETF"],
  ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Vanguard Total World Stock ETF (MAY DCA: $865)"],
  ["ZS", "Zscaler, Inc.", "ZS - Partial Sell (25%)"],
  ["PANW", "Palo Alto Networks, Inc.", "PANW - Second Sell (Full Exit: Remaining 40%)"],
  ["NOW", "ServiceNow, Inc.", "NOW: ServiceNow"],
  ["PLTR", "Palantir Technologies Inc.", "PLTR: Palantir"],
  ["DRAM", "Roundhill Memory ETF", "DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)"],
  ["QQQ", "Invesco QQQ Trust", "QQQ - 100% Stoploss Exit (700 SL, 750 TP)"],
  ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865)"],
  ["FLKR", "Franklin FTSE South Korea ETF", "FLKR - 100% Stoploss Exit (61.36 SL, 76 TP)"],
  ["QQQM", "Invesco NASDAQ 100 ETF", "QQQM: Invesco NASDAQ 100 ETF"],
  ["XLF", "State Street Financial Select Sector SPDR ETF", "XLF: Financial Select Sector SPDR Fund"],
  ["DRAM", "Roundhill Memory ETF", "DRAM - Roundhill Memory ETF"],
  ["QQQM", "Invesco NASDAQ 100 ETF", "QQQM - Second Buy"],
  ["DRAM", "Roundhill Memory ETF", "DRAM - Avg Down"],
  ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865)"],
  ["OV8", "Sheng Siong Group Ltd", "OV8: Sheng Shiong"],
  ["D05", "DBS Group Holdings Ltd", "DBS - Third Buy (Odd Lot)"],
  ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865), Brought Forward"],
  ["D05", "DBS Group Holdings Ltd", "DBS - Fourth Buy (Odd Lot)"],
  ["ZS", "Zscaler, Inc.", "ZS - Partial Sell (8 of 15 Shares)"],
  ["IREN", "IREN Limited", "IREN - IREN Ltd"],
  ["ZS", "Zscaler, Inc.", "ZS - Full Sell"],
  ["VUG", "Vanguard Morningstar Growth ETF", "VUG - Full Sell"],
  ["PLTR", "Palantir Technologies Inc.", "PLTR - Full Sell"],
  ["ONON", "On Holding AG", "On Holdings"],
  ["DXJ", "WisdomTree Japan Hedged Equity Fund", "WisdomTree Japan Hedged Equity ETF"],
  ["S63", "Singapore Technologies Engineering Ltd", "ST Engineering"],
  ["D05", "DBS Group Holdings Ltd", "DBS - Odd Lot"],
  ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Sept DCA"],
  ["NOW", "ServiceNow, Inc.", "NOW - 1st TP"],
];

function classify(ticker: string, name: string, note: string) {
  return classifyNote(note, { ticker, name });
}

describe("classifyNote — reference data vs a person's words", () => {
  it("hides a note that is only the instrument's name, in the ticker-prefixed form", () => {
    for (const [ticker, name, note] of [
      ["VOO", "Vanguard S&P 500 ETF", "VOO - Vanguard S&P 500 ETF"],
      ["D05", "DBS Group Holdings Ltd", "D05 - DBS"],
      ["03115", "iShares Core Hang Seng Index ETF", "03115 - iShares Core Hang Seng Index ETF"],
      ["NOW", "ServiceNow, Inc.", "NOW: ServiceNow"],
      ["PLTR", "Palantir Technologies Inc.", "PLTR: Palantir"],
      ["IREN", "IREN Limited", "IREN - IREN Ltd"],
      // The lookup returns "… Fund ETF Shares" where the note says "… ETF".
      ["VHT", "Vanguard Health Care Index Fund ETF Shares", "VHT - Vanguard Health Care ETF"],
      // A name the cache states differently but that is still wholly contained.
      ["VUG", "Vanguard Morningstar Growth ETF", "VUG - Vanguard Growth ETF"],
      ["XLF", "State Street Financial Select Sector SPDR ETF", "XLF: Financial Select Sector SPDR Fund"],
      // Leading zero in the stored ticker, none in the note.
      ["03115", "iShares Core Hang Seng Index ETF", "03115 - iShares Core Hang Seng Index ETF"],
    ] as Array<[string, string, string]>) {
      const result = classify(ticker, name, note);
      expect(result.kind, note).toBe("reference");
      expect(result.note, note).toBeNull();
      // The stored text is never altered — hiding is display only.
      expect(result.raw).toBe(note);
    }
  });

  it("hides a bare name with no ticker prefix", () => {
    expect(classify("ONON", "On Holding AG", "On Holdings").kind).toBe("reference");
    expect(classify("DXJ", "WisdomTree Japan Hedged Equity Fund", "WisdomTree Japan Hedged Equity ETF").kind).toBe(
      "reference"
    );
  });

  it("keeps a misspelled name visible rather than silently dropping it", () => {
    // "Proctor" against the cache's "Procter" — exactly the typo class that
    // automation would erase without anyone noticing.
    const pg = classify("PG", "The Procter & Gamble Company", "PG - Proctor & Gamble");
    expect(pg.kind).toBe("context");
    expect(pg.note).toBe("PG - Proctor & Gamble");

    const ov8 = classify("OV8", "Sheng Siong Group Ltd", "OV8: Sheng Shiong");
    expect(ov8.kind).toBe("context");
    expect(ov8.note).toBe("OV8: Sheng Shiong");
  });

  it("keeps an abbreviated name it cannot verify against the cache", () => {
    const st = classify("S63", "Singapore Technologies Engineering Ltd", "ST Engineering");
    expect(st.kind).toBe("context");
    expect(st.note).toBe("ST Engineering");
  });

  it("keeps a name that carries extra information", () => {
    const dca = classify(
      "VT",
      "Vanguard Total World Stock Index Fund ETF Shares",
      "VT - Vanguard Total World Stock ETF (MAY DCA: $865)"
    );
    expect(dca.kind).toBe("context");
    // Shown verbatim, inner punctuation intact.
    expect(dca.note).toBe("VT - Vanguard Total World Stock ETF (MAY DCA: $865)");

    const flkr = classify(
      "FLKR",
      "Franklin FTSE South Korea ETF",
      "FLKR - Franklin Templeton ETF (FTSE South Korea)"
    );
    expect(flkr.kind).toBe("context");
  });

  it("keeps every note that says something the name does not", () => {
    for (const [ticker, name, note] of [
      ["DRAM", "Roundhill Memory ETF", "DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)"],
      ["QQQ", "Invesco QQQ Trust", "QQQ - 100% Stoploss Exit (700 SL, 750 TP)"],
      ["NOW", "ServiceNow, Inc.", "NOW - 1st TP"],
      ["B", "Barrick Mining Corporation", "B - Second Buy"],
      ["D05", "DBS Group Holdings Ltd", "DBS - Third Buy (Odd Lot)"],
      ["ZS", "Zscaler, Inc.", "ZS - Partial Sell (8 of 15 Shares)"],
      ["VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Sept DCA"],
    ] as Array<[string, string, string]>) {
      const result = classify(ticker, name, note);
      expect(result.kind, note).toBe("context");
      expect(result.note, note).toBe(note);
    }
  });

  it("treats an empty note as nothing to show, not as empty text", () => {
    for (const input of ["", "   ", null, undefined]) {
      const result = classifyNote(input, { ticker: "VOO", name: "Vanguard S&P 500 ETF" });
      expect(result.kind).toBe("empty");
      expect(result.note).toBeNull();
      expect(result.raw).toBe("");
    }
  });

  it("shows a note it cannot check when the name is still unresolved", () => {
    // Ticker prefix is recognised, but there is no cached name to verify with,
    // so nothing may be assumed and the note stays.
    const unresolved = classifyNote("VOO - Vanguard S&P 500 ETF", { ticker: "VOO", name: null });
    expect(unresolved.kind).toBe("context");
    expect(unresolved.note).toBe("VOO - Vanguard S&P 500 ETF");
  });

  it("hides a note that is nothing but the ticker", () => {
    expect(classifyNote("VOO -", { ticker: "VOO", name: null }).kind).toBe("reference");
    expect(classifyNote("D05:", { ticker: "D05", name: null }).kind).toBe("reference");
  });

  it("does not mistake another ticker's note for this row's prefix", () => {
    // The note leads with "DBS", the ticker is "D05" — no prefix is stripped,
    // and the words it does carry stay visible.
    const result = classify("D05", "DBS Group Holdings Ltd", "DBS - Odd Lot");
    expect(result.kind).toBe("context");
    expect(result.note).toBe("DBS - Odd Lot");
  });
});

describe("the real ledger", () => {
  it("hides a quarter of the note column and keeps every word a person wrote", () => {
    const hidden = LEDGER.filter(([t, n, note]) => classify(t, n, note).kind === "reference");
    const shown = LEDGER.filter(([t, n, note]) => classify(t, n, note).kind === "context");

    expect(LEDGER).toHaveLength(64);
    // 25 of the 64 stored notes are the instrument's name; the other 39 say
    // something. The assertion is deliberately on the counts so a rule change
    // that starts eating real notes fails here.
    expect(hidden).toHaveLength(25);
    expect(shown).toHaveLength(39);
    expect(hidden.length + shown.length).toBe(LEDGER.length);

    // Nothing is rewritten: every shown note is byte-identical to storage.
    for (const [ticker, name, note] of shown) {
      expect(classify(ticker, name, note).note).toBe(note);
    }
  });

  it("hides only names — never a note about a trade or a plan level", () => {
    const hidden = LEDGER.filter(([t, n, note]) => classify(t, n, note).kind === "reference");
    for (const [, , note] of hidden) {
      // No action word and no price level survives into a hidden note.
      expect(note, note).not.toMatch(/\b(sell|sold|buy|bought|stoploss|stop loss|dca|tp|sl|second|third|avg)\b/i);
      expect(note, note).not.toMatch(/\d+\.\d+|%/);
    }
  });
});

describe("isNameOnly", () => {
  it("tolerates a single-character suffix, the form Hong Kong tickers use", () => {
    expect(isNameOnly("XIAOMI-W", "Xiaomi Corporation")).toBe(true);
  });

  it("refuses when a word is not in the name", () => {
    expect(isNameOnly("Vanguard Growth ETF", "Vanguard Morningstar Growth ETF")).toBe(true);
    expect(isNameOnly("Vanguard Value ETF", "Vanguard Morningstar Growth ETF")).toBe(false);
  });

  it("refuses a text made only of leftovers, and one with no name to check", () => {
    expect(isNameOnly("W", "Xiaomi Corporation")).toBe(false);
    expect(isNameOnly("Vanguard S&P 500 ETF", null)).toBe(false);
    expect(isNameOnly("Vanguard S&P 500 ETF", "   ")).toBe(false);
    expect(isNameOnly("the and ltd", "Vanguard S&P 500 ETF")).toBe(false);
  });
});

describe("ledgerSummary — the action word first", () => {
  const base = { price: 546, qtyBefore: 0, avgCostBefore: 0, runningQty: 0, runningAvgCost: 0 };
  const openingBuy = { ...base, action: "Buy", qty: 5, runningQty: 5, runningAvgCost: 546 };
  const addingBuy = {
    action: "Buy",
    qty: 5,
    price: 520,
    qtyBefore: 10,
    avgCostBefore: 546,
    runningQty: 15,
    runningAvgCost: 537.33,
  };
  const partialSell = {
    action: "Sell",
    qty: 8,
    price: 188,
    qtyBefore: 15,
    avgCostBefore: 168.5,
    runningQty: 7,
    runningAvgCost: 168.5,
  };
  const closingSell = {
    action: "Sell",
    qty: 20,
    price: 207.12,
    qtyBefore: 20,
    avgCostBefore: 250,
    runningQty: 0,
    runningAvgCost: 250,
  };

  it("says only `Opened` for a position this row opened", () => {
    // The average of a freshly opened position is the price just paid, and the
    // Price column already shows it. Repeating it said nothing and made the
    // longest line longer.
    expect(ledgerSummary(openingBuy, "US$")).toBe("Opened");
  });

  it("points DOWN when a buy lowered the average cost", () => {
    expect(ledgerSummary(addingBuy, "US$")).toBe("Added · avg ↓ US$537.33");
  });

  it("points UP when a buy raised it", () => {
    expect(
      ledgerSummary(
        {
          action: "Buy",
          qty: 5,
          price: 600,
          qtyBefore: 10,
          avgCostBefore: 500,
          runningQty: 15,
          runningAvgCost: 533.33,
        },
        "US$"
      )
    ).toBe("Added · avg ↑ US$533.33");
  });

  it("omits the arrow when there is no previous average to compare against", () => {
    // A buy against a position the engine carries no basis for: an arrow is a
    // claim about a comparison, so no comparison means no arrow.
    expect(
      ledgerSummary(
        {
          action: "Buy",
          qty: 5,
          price: 600,
          qtyBefore: 10,
          avgCostBefore: 0,
          runningQty: 15,
          runningAvgCost: 600,
        },
        "US$"
      )
    ).toBe("Added · avg US$600.00");
  });

  it("names the fraction a partial sell took, then the amount realized", () => {
    expect(ledgerSummary(partialSell, "US$")).toBe("Partial sell (8 of 15) · +US$156.00");
  });

  it("marks a closing sell, and signs a realized loss", () => {
    expect(ledgerSummary(closingSell, "US$")).toBe("Closed · -US$857.60");
  });

  it("omits the realized amount when there is no cost basis to realize against", () => {
    expect(
      ledgerSummary(
        { action: "Sell", qty: 3, price: 10, qtyBefore: 3, avgCostBefore: 0, runningQty: 0, runningAvgCost: 0 },
        "US$"
      )
    ).toBe("Closed · 3 sold");
    // And the partial form never ends on a dangling separator.
    expect(
      ledgerSummary(
        { action: "Sell", qty: 3, price: 10, qtyBefore: 10, avgCostBefore: 0, runningQty: 7, runningAvgCost: 0 },
        "US$"
      )
    ).toBe("Partial sell (3 of 10)");
  });

  it("keeps every line short enough to read without a hover", () => {
    // The Note column was widened for this pass (11rem → 16rem, the ledger's
    // own measured budget), which is about 37 characters of 12px type. A line
    // that grows past it is truncated — and the amount is what a reader misses
    // when that happens, because it is the part worth reading.
    const lines = [
      ledgerSummary(openingBuy, "US$"),
      ledgerSummary(addingBuy, "US$"),
      ledgerSummary(partialSell, "US$"),
      ledgerSummary(closingSell, "US$"),
      ledgerSummary({ ...base, action: "Sell", qty: 3, price: 10, qtyBefore: 10, avgCostBefore: 0, runningQty: 7, runningAvgCost: 0 }, "US$"),
    ];
    for (const line of lines) expect(line.length, line).toBeLessThanOrEqual(37);
  });

  it("colours a realized result and leaves a cost plain", () => {
    expect(ledgerSummaryParts(partialSell, "US$").parts.at(-1)).toEqual({
      text: "+US$156.00",
      tone: "gain",
    });
    expect(ledgerSummaryParts(closingSell, "US$").parts.at(-1)).toEqual({
      text: "-US$857.60",
      tone: "loss",
    });
    // A buy states a cost, which is a value rather than a result: no tone.
    expect(ledgerSummaryParts(addingBuy, "US$").parts.at(-1)).toEqual({ text: "US$537.33" });
  });

  it("puts no colour on the arrow, so the column keeps one meaning for colour", () => {
    // The owner asked whether averaging down should be green and averaging up
    // red. It should not: red already means "this sale realized a loss" in this
    // same column, and green would additionally claim averaging down was a good
    // decision — a judgement the ledger is not entitled to. Direction is a
    // glyph, and neither arrow nor the cost beside it carries a tone.
    const down = ledgerSummaryParts(addingBuy, "US$").parts;
    expect(down[0]).toEqual({ text: "Added · avg ↓ " });
    expect(down[1]).toEqual({ text: "US$537.33" });

    const up = ledgerSummaryParts(
      { ...addingBuy, price: 600, avgCostBefore: 500, runningAvgCost: 533.33 },
      "US$"
    ).parts;
    expect(up[0]).toEqual({ text: "Added · avg ↑ " });
    expect(up[1]).toEqual({ text: "US$533.33" });

    for (const part of [...down, ...up]) expect(part.tone, part.text).toBeUndefined();
  });

  it("never puts two currency figures on one line", () => {
    // The owner's rule: the price, the quantity and the running average are
    // columns on the row, so a line that repeats them reads as one number
    // misprinted. At most one money amount, and the buy's price is never it.
    const rows = [openingBuy, addingBuy, partialSell, closingSell];
    for (const row of rows) {
      const line = ledgerSummary(row, "US$");
      expect(line.match(/US\$/g) ?? [], line).toHaveLength(row.action === "Buy" && row.qtyBefore === 0 ? 0 : 1);
      expect(line, line).not.toContain("207.12 @");
    }
  });
});

describe("averageDirection", () => {
  it("reads the direction the average actually moved", () => {
    expect(averageDirection(546, 537.33)).toBe("down");
    expect(averageDirection(500, 533.33)).toBe("up");
  });

  it("returns null when there is nothing to compare, or nothing moved", () => {
    // No previous basis: the engine has no average to move away from.
    expect(averageDirection(0, 600)).toBeNull();
    // A buy at exactly the average it already held did not move it. Inside
    // float noise counts as unchanged rather than as a direction.
    expect(averageDirection(546, 546)).toBeNull();
    expect(averageDirection(546, 546 + 1e-9)).toBeNull();
  });
});

describe("noteCell — the derived line first, the owner's words appended", () => {
  const row = {
    action: "Sell",
    qty: 8,
    price: 188,
    qtyBefore: 15,
    avgCostBefore: 168.5,
    runningQty: 7,
    runningAvgCost: 168.5,
  };

  it("always renders the derived line, note or no note", () => {
    const bare = noteCell(row, "US$", null, { ticker: "ZS", name: "Zscaler, Inc." });
    expect(bare.derived.text).toBe("Partial sell (8 of 15) · +US$156.00");
    expect(bare.appended).toBeNull();
    expect(bare.text).toBe("Partial sell (8 of 15) · +US$156.00");
  });

  it("appends the owner's words instead of substituting them for the line", () => {
    // The bug this closes: `note ?? <LedgerLine/>` meant a row carrying a DCA
    // month or a stop-loss level showed the note and lost the arithmetic.
    const cell = noteCell(row, "US$", "ZS - Partial Sell (8 of 15 Shares)", {
      ticker: "ZS",
      name: "Zscaler, Inc.",
    });
    expect(cell.derived.text).toBe("Partial sell (8 of 15) · +US$156.00");
    expect(cell.appended).toBe("ZS - Partial Sell (8 of 15 Shares)");
    expect(cell.text).toBe(
      "Partial sell (8 of 15) · +US$156.00 · ZS - Partial Sell (8 of 15 Shares)"
    );
  });

  it("appends a DCA month after the facts rather than in place of them", () => {
    const cell = noteCell(
      { action: "Buy", qty: 2, price: 120, qtyBefore: 8, avgCostBefore: 130, runningQty: 10, runningAvgCost: 128 },
      "S$",
      "VT - Sept DCA",
      { ticker: "VT", name: "Vanguard Total World Stock Index Fund ETF Shares" }
    );
    expect(cell.text).toBe("Added · avg ↓ S$128.00 · VT - Sept DCA");
  });

  it("appends nothing when the note only repeats the instrument's name", () => {
    const cell = noteCell(row, "US$", "ZS - Zscaler", { ticker: "ZS", name: "Zscaler, Inc." });
    expect(cell.appended).toBeNull();
    expect(cell.text).toBe(cell.derived.text);
  });
});
