import { describe, it, expect } from "vitest";
import { planNoteChange, type CleanupReason } from "@/lib/notes-cleanup";

/** Every row in the real ledger, read from the shared database on 2026-09-23:
 *  (date, ticker, cached name, note). The cleanup's expected outcome for each is
 *  asserted below, so a rule change that starts clearing a plan — or keeping a
 *  restatement — fails here rather than in the database. */
const LEDGER: Array<[date: string, ticker: string, name: string, note: string]> = [
  ["2025-03-03", "VOO", "Vanguard S&P 500 ETF", "VOO - Vanguard S&P 500 ETF"],
  ["2025-03-03", "D05", "DBS Group Holdings Ltd", "D05 - DBS"],
  ["2025-03-05", "SLV", "iShares Silver Trust", "SLV - iShares Silver Trust"],
  ["2025-04-03", "B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["2025-04-24", "B", "Barrick Mining Corporation", "B - Second Buy"],
  ["2025-06-02", "B", "Barrick Mining Corporation", "B - Sell All"],
  ["2025-06-05", "QQQ", "Invesco QQQ Trust", "QQQ - Invesco QQQ Trust"],
  ["2025-06-05", "QQQ", "Invesco QQQ Trust", "QQQ - Sell All"],
  ["2025-06-06", "D05", "DBS Group Holdings Ltd", "D05 - Second Buy"],
  ["2025-07-08", "VOO", "Vanguard S&P 500 ETF", "VOO - Sell All"],
  ["2025-07-08", "PG", "The Procter & Gamble Company", "PG - Proctor & Gamble"],
  ["2025-07-11", "PANW", "Palo Alto Networks, Inc.", "PANW - Palo Alto Networks"],
  ["2025-07-11", "ZS", "Zscaler, Inc.", "ZS - Zscaler"],
  ["2025-08-13", "03115", "iShares Core Hang Seng Index ETF", "03115 - iShares Core Hang Seng Index ETF"],
  ["2025-08-19", "01810", "Xiaomi Corporation", "01810 - XIAOMI-W"],
  ["2025-09-24", "B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["2025-10-09", "QQQ", "Invesco QQQ Trust", "QQQ - Invesco QQQ Trust"],
  ["2025-10-13", "VUG", "Vanguard Morningstar Growth ETF", "VUG - Vanguard Growth ETF"],
  ["2025-10-13", "ES3", "State Street SPDR Straits Times Index ETF", "ES3 - STI ETF"],
  ["2025-11-14", "03115", "iShares Core Hang Seng Index ETF", "03115 - Sell All"],
  ["2025-12-22", "B", "Barrick Mining Corporation", "B - Sell All"],
  ["2025-12-22", "ZS", "Zscaler, Inc.", "ZS - Second Buy (Avg Down to x10@$263.25)"],
  ["2025-12-24", "B", "Barrick Mining Corporation", "B - Barrick Mining"],
  ["2026-01-29", "VOO", "Vanguard S&P 500 ETF", "VOO - Vanguard S&P 500 ETF"],
  ["2026-01-30", "B", "Barrick Mining Corporation", "B - Second Buy"],
  ["2026-02-24", "PG", "The Procter & Gamble Company", "PG - Sell All"],
  ["2026-04-08", "VOO", "Vanguard S&P 500 ETF", "VOO - Second Buy (Avg Down to x10@$629)"],
  ["2026-05-06", "QQQ", "Invesco QQQ Trust", "QQQ - Sell Part (60%)"],
  ["2026-05-11", "ZS", "Zscaler, Inc.", "ZS - Third buy (Avg down to x20@$207.12)"],
  ["2026-05-11", "IXJ", "iShares Global Healthcare ETF", "IXJ - iShares Global Healthcare ETF"],
  ["2026-05-11", "VHT", "Vanguard Health Care Index Fund ETF Shares", "VHT - Vanguard Health Care ETF"],
  ["2026-05-14", "PANW", "Palo Alto Networks, Inc.", "PANW - Partial Exit (60%)"],
  ["2026-05-18", "FLKR", "Franklin FTSE South Korea ETF", "FLKR - Franklin Templeton ETF (FTSE South Korea)"],
  ["2026-05-18", "DRAM", "Roundhill Memory ETF", "DRAM - Roundhill Memory ETF"],
  ["2026-05-18", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Vanguard Total World Stock ETF (MAY DCA: $865)"],
  ["2026-05-22", "ZS", "Zscaler, Inc.", "ZS - Partial Sell (25%)"],
  ["2026-05-26", "PANW", "Palo Alto Networks, Inc.", "PANW - Second Sell (Full Exit: Remaining 40%)"],
  ["2026-05-26", "NOW", "ServiceNow, Inc.", "NOW: ServiceNow"],
  ["2026-06-02", "PLTR", "Palantir Technologies Inc.", "PLTR: Palantir"],
  ["2026-06-05", "DRAM", "Roundhill Memory ETF", "DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)"],
  ["2026-06-05", "QQQ", "Invesco QQQ Trust", "QQQ - 100% Stoploss Exit (700 SL, 750 TP)"],
  ["2026-06-08", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865)"],
  ["2026-06-08", "FLKR", "Franklin FTSE South Korea ETF", "FLKR - 100% Stoploss Exit (61.36 SL, 76 TP)"],
  ["2026-06-12", "QQQM", "Invesco NASDAQ 100 ETF", "QQQM: Invesco NASDAQ 100 ETF"],
  ["2026-06-18", "XLF", "State Street Financial Select Sector SPDR ETF", "XLF: Financial Select Sector SPDR Fund"],
  ["2026-06-23", "DRAM", "Roundhill Memory ETF", "DRAM - Roundhill Memory ETF"],
  ["2026-06-23", "QQQM", "Invesco NASDAQ 100 ETF", "QQQM - Second Buy"],
  ["2026-07-02", "DRAM", "Roundhill Memory ETF", "DRAM - Avg Down"],
  ["2026-07-08", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865)"],
  ["2026-07-14", "OV8", "Sheng Siong Group Ltd", "OV8: Sheng Shiong"],
  ["2026-07-21", "D05", "DBS Group Holdings Ltd", "DBS - Third Buy (Odd Lot)"],
  ["2026-08-05", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Monthly DCA ($865), Brought Forward"],
  ["2026-08-13", "D05", "DBS Group Holdings Ltd", "DBS - Fourth Buy (Odd Lot)"],
  ["2026-08-18", "ZS", "Zscaler, Inc.", "ZS - Partial Sell (8 of 15 Shares)"],
  ["2026-08-18", "IREN", "IREN Limited", "IREN - IREN Ltd"],
  ["2026-08-31", "ZS", "Zscaler, Inc.", "ZS - Full Sell"],
  ["2026-09-03", "VUG", "Vanguard Morningstar Growth ETF", "VUG - Full Sell"],
  ["2026-09-03", "PLTR", "Palantir Technologies Inc.", "PLTR - Full Sell"],
  ["2026-09-04", "ONON", "On Holding AG", "On Holdings"],
  ["2026-09-08", "DXJ", "WisdomTree Japan Hedged Equity Fund", "WisdomTree Japan Hedged Equity ETF"],
  ["2026-09-09", "S63", "Singapore Technologies Engineering Ltd", "ST Engineering"],
  ["2026-09-09", "D05", "DBS Group Holdings Ltd", "DBS - Odd Lot"],
  ["2026-09-09", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "VT - Sept DCA"],
  ["2026-09-16", "NOW", "ServiceNow, Inc.", "NOW - 1st TP"],
];

function plan([date, ticker, name, note]: (typeof LEDGER)[number]) {
  return planNoteChange(note, { ticker, name, date: new Date(`${date}T00:00:00.000Z`) });
}

describe("planNoteChange — the owner's verdicts, applied to the real ledger", () => {
  it("covers all 64 stored notes and clears or rewrites 59 of them", () => {
    expect(LEDGER).toHaveLength(64);
    const plans = LEDGER.map(plan);
    const byReason = (r: CleanupReason) => plans.filter((p) => p.reason === r);
    const cleared = plans.filter((p) => p.after === null);
    const rewritten = plans.filter((p) => p.after !== null && p.changed);
    const untouched = plans.filter((p) => !p.changed);

    expect(byReason("reference")).toHaveLength(25);
    expect(byReason("reviewed-name")).toHaveLength(4);
    expect(byReason("restates-action")).toHaveLength(19);
    expect(byReason("achieved-average")).toHaveLength(3);
    expect(byReason("odd-lot")).toHaveLength(3);
    expect(byReason("dca-month")).toHaveLength(5);
    expect(byReason("keep")).toHaveLength(5);

    expect(cleared).toHaveLength(51);
    expect(rewritten).toHaveLength(8);
    expect(untouched).toHaveLength(5);
  });

  it("keeps exactly the five notes that carry something nothing else stores", () => {
    const kept = LEDGER.map(plan)
      .filter((p) => p.reason === "keep")
      .map((p) => p.before);
    expect(kept).toEqual([
      "FLKR - Franklin Templeton ETF (FTSE South Korea)",
      "DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)",
      "QQQ - 100% Stoploss Exit (700 SL, 750 TP)",
      "FLKR - 100% Stoploss Exit (61.36 SL, 76 TP)",
      "NOW - 1st TP",
    ]);
  });

  it("names the allocation month on every DCA row, from the row's own date", () => {
    const dca = LEDGER.map(plan).filter((p) => p.reason === "dca-month");
    expect(dca.map((p) => p.after)).toEqual([
      "DCA · May 2026",
      "DCA · Jun 2026",
      "DCA · Jul 2026",
      // "Brought Forward" is dropped: the owner wants the month and nothing else.
      "DCA · Aug 2026",
      "DCA · Sep 2026",
    ]);
  });

  it("keeps the odd-lot marker and drops the ordinal around it", () => {
    const odd = LEDGER.map(plan).filter((p) => p.reason === "odd-lot");
    expect(odd.map((p) => p.before)).toEqual([
      "DBS - Third Buy (Odd Lot)",
      "DBS - Fourth Buy (Odd Lot)",
      "DBS - Odd Lot",
    ]);
    for (const p of odd) expect(p.after).toBe("Odd Lot");
  });

  it("clears the four names the owner reviewed one by one", () => {
    const reviewed = LEDGER.map(plan).filter((p) => p.reason === "reviewed-name");
    expect(reviewed.map((p) => p.before)).toEqual([
      "PG - Proctor & Gamble",
      "ES3 - STI ETF",
      "OV8: Sheng Shiong",
      "ST Engineering",
    ]);
  });

  it("never clears a note that states a level or an amount outside parentheses", () => {
    // The invariant behind rule 5: a digit outside the parenthetical is a plan,
    // and a plan is never cleared. It is what protects the SL/TP notes and
    // `1st TP` from the restatement rule.
    for (const row of LEDGER) {
      const p = plan(row);
      if (p.after !== null) continue;
      const outsideParens = p.before.replace(/\([^)]*\)/g, " ");
      expect(outsideParens, p.before).not.toMatch(/\d[^\s)]*\s*(sl|tp)\b/i);
    }
  });

  it("leaves a note it does not have a verdict for exactly as it was", () => {
    for (const row of LEDGER) {
      const p = plan(row);
      if (p.reason === "keep") {
        expect(p.after).toBe(p.before);
        expect(p.changed).toBe(false);
      }
      // No plan ever invents text: every outcome either clears or keeps the
      // original, except the two normalised forms.
      if (p.after !== null && p.after !== p.before) {
        expect(p.reason === "odd-lot" || p.reason === "dca-month", `${p.before} -> ${p.after}`).toBe(true);
      }
    }
  });
});
