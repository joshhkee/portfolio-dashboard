import { describe, it, expect } from "vitest";
import { classifyNote, isNameOnly, ledgerSummary } from "@/lib/notes";

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

describe("ledgerSummary", () => {
  const base = { price: 546, qtyBefore: 0, avgCostBefore: 0, runningQty: 0, runningAvgCost: 0 };

  it("describes an opening buy", () => {
    expect(
      ledgerSummary({ ...base, action: "Buy", qty: 5, runningQty: 5, runningAvgCost: 546 }, "US$")
    ).toBe("Opened · 5 @ US$546.00");
  });

  it("describes a buy that moved the average", () => {
    expect(
      ledgerSummary(
        {
          action: "Buy",
          qty: 5,
          price: 520,
          qtyBefore: 10,
          avgCostBefore: 546,
          runningQty: 15,
          runningAvgCost: 537.33,
        },
        "US$"
      )
    ).toBe("Added 5 @ US$520.00 · avg US$546.00 → US$537.33");
  });

  it("describes a partial sell with the realized amount", () => {
    expect(
      ledgerSummary(
        {
          action: "Sell",
          qty: 10,
          price: 144,
          qtyBefore: 15,
          avgCostBefore: 120,
          runningQty: 5,
          runningAvgCost: 120,
        },
        "S$"
      )
    ).toBe("Sold 10 @ S$144.00 · +S$240.00 · 5 left");
  });

  it("describes a closing sell, and signs a realized loss", () => {
    expect(
      ledgerSummary(
        {
          action: "Sell",
          qty: 20,
          price: 207.12,
          qtyBefore: 20,
          avgCostBefore: 250,
          runningQty: 0,
          runningAvgCost: 250,
        },
        "US$"
      )
    ).toBe("Closed · sold 20 @ US$207.12 · -US$857.60");
  });

  it("omits the realized amount when there is no cost basis to realize against", () => {
    expect(
      ledgerSummary(
        { action: "Sell", qty: 3, price: 10, qtyBefore: 3, avgCostBefore: 0, runningQty: 0, runningAvgCost: 0 },
        "US$"
      )
    ).toBe("Closed · sold 3 @ US$10.00");
  });
});
