import { describe, it, expect } from "vitest";
import {
  SECTOR_TAGS,
  isSectorTag,
  sectorTagList,
  suggestSector,
} from "@/lib/sectors";

describe("the tag vocabulary", () => {
  it("is the ten tags the owner chose, in dropdown order", () => {
    expect(SECTOR_TAGS).toHaveLength(10);
    expect(SECTOR_TAGS[0]).toBe("Financials");
    expect(SECTOR_TAGS).toContain("Japan (Hedged)");
    expect(sectorTagList()).toEqual([...SECTOR_TAGS]);
  });

  it("accepts its own tags and refuses anything else", () => {
    for (const tag of SECTOR_TAGS) expect(isSectorTag(tag)).toBe(true);
    expect(isSectorTag("Banks")).toBe(false);
    expect(isSectorTag("financials")).toBe(false);
    expect(isSectorTag("")).toBe(false);
  });
});

describe("suggestSector for the 18 holdings in this portfolio", () => {
  // The instruments as the cache holds them, with the tag each should get.
  // Hand-written rather than read from the database so the expectation is
  // reviewable: if a tag changes, this test says which instrument moved.
  const held: [string, string, string, string | null][] = [
    ["SG", "D05", "DBS Group Holdings Ltd", "Financials"],
    ["SG", "ES3", "State Street SPDR Straits Times Index ETF", "Singapore Market"],
    ["SG", "OV8", "Sheng Siong Group Ltd", "Consumer"],
    ["SG", "S63", "Singapore Technologies Engineering Ltd", "Industrials & Defence"],
    ["HK", "01810", "Xiaomi Corporation", "Consumer"],
    ["US", "VOO", "Vanguard S&P 500 ETF", "US Broad Market"],
    ["US", "VT", "Vanguard Total World Stock Index Fund ETF Shares", "Global Broad Market"],
    ["US", "QQQM", "Invesco NASDAQ 100 ETF", "US Tech"],
    ["US", "DRAM", "Roundhill Memory ETF", "US Tech"],
    ["US", "NOW", "ServiceNow, Inc.", "US Tech"],
    ["US", "IREN", "IREN Limited", "US Tech"],
    ["US", "B", "Barrick Mining Corporation", "Precious Metals"],
    ["US", "SLV", "iShares Silver Trust", "Precious Metals"],
    ["US", "VHT", "Vanguard Health Care Index Fund ETF Shares", "Healthcare"],
    ["US", "IXJ", "iShares Global Healthcare ETF", "Healthcare"],
    ["US", "XLF", "State Street Financial Select Sector SPDR ETF", "Financials"],
    ["US", "DXJ", "WisdomTree Japan Hedged Equity Fund", "Japan (Hedged)"],
    ["US", "ONON", "On Holding AG", "Consumer"],
  ];

  it("tags all 18 by the instrument name and ticker alone", () => {
    for (const [region, ticker, name, expected] of held) {
      expect(suggestSector({ region, ticker, name, instrumentType: "ETF" }), `${region}:${ticker}`).toBe(
        expected
      );
    }
  });

  it("covers every held instrument — 18 positions, none left unclassified", () => {
    const tagged = held.filter(
      ([region, ticker, name]) => suggestSector({ region, ticker, name }) !== null
    );
    expect(tagged).toHaveLength(18);
  });

  it("tags the watchlist the same way, because it is the same classifier", () => {
    expect(suggestSector({ region: "US", ticker: "QQQ", name: "Invesco QQQ Trust" })).toBe("US Tech");
    expect(suggestSector({ region: "US", ticker: "PLTR", name: "Palantir Technologies Inc." })).toBe(
      "US Tech"
    );
    expect(suggestSector({ region: "US", ticker: "PG", name: "The Procter & Gamble Company" })).toBe(
      "Consumer"
    );
    expect(suggestSector({ region: "US", ticker: "ZS", name: "Zscaler, Inc." })).toBe("US Tech");
  });
});

describe("suggestSector refuses to guess", () => {
  it("returns null for a country with no tag in this vocabulary", () => {
    // South Korea and Hong Kong are real exposures with no tag the owner asked
    // for. Filing them under something adjacent would be a silent lie.
    expect(suggestSector({ region: "US", ticker: "FLKR", name: "Franklin FTSE South Korea ETF" })).toBeNull();
    expect(
      suggestSector({ region: "HK", ticker: "03115", name: "iShares Core Hang Seng Index ETF" })
    ).toBeNull();
  });

  it("returns null rather than a wrong bucket for a growth index", () => {
    expect(
      suggestSector({ region: "US", ticker: "VUG", name: "Vanguard Morningstar Growth ETF" })
    ).toBeNull();
  });

  it("returns null when nothing is known about the instrument yet", () => {
    expect(suggestSector({ region: "US", ticker: "NVDA", name: null })).toBeNull();
    expect(suggestSector({ region: "US", ticker: "NVDA", name: "" })).toBeNull();
    expect(suggestSector({ region: "US", ticker: "UNKNOWN" })).toBeNull();
  });

  it("only ever returns one of the ten tags", () => {
    const names = [
      "Some Bank Ltd",
      "Global Healthcare Fund",
      "Acme Mining Corporation",
      "Nice Retail Stores Inc",
      "Foo Industries",
      "Random Corp",
    ];
    for (const name of names) {
      const tag = suggestSector({ region: "US", ticker: "ZZZZ", name });
      if (tag !== null) expect(isSectorTag(tag)).toBe(true);
    }
  });
});

describe("suggestSector matches names, not tickers alone", () => {
  it("tags an unfamiliar instrument from its name", () => {
    expect(suggestSector({ region: "US", ticker: "XYZ", name: "Melbourne Bank Ltd" })).toBe("Financials");
    expect(suggestSector({ region: "US", ticker: "XYZ", name: "Acme Pharmaceuticals Inc" })).toBe(
      "Healthcare"
    );
    expect(suggestSector({ region: "US", ticker: "XYZ", name: "Northern Gold Mines" })).toBe(
      "Precious Metals"
    );
    expect(suggestSector({ region: "US", ticker: "XYZ", name: "Nippon Industries KK" })).toBe(
      "Industrials & Defence"
    );
  });

  it("is case-insensitive", () => {
    expect(suggestSector({ region: "US", ticker: "X", name: "GLOBAL HEALTHCARE ETF" })).toBe(
      "Healthcare"
    );
  });

  it("matches inflected words, not just the exact spelling", () => {
    // "Financials" and "Pharmaceuticals" are the shapes that broke the first
    // version of the rules: a trailing word boundary does not match them.
    expect(suggestSector({ region: "US", ticker: "X", name: "Acme Financials Corp" })).toBe(
      "Financials"
    );
    expect(suggestSector({ region: "US", ticker: "X", name: "Illinois Banking Group" })).toBe(
      "Financials"
    );
    expect(suggestSector({ region: "US", ticker: "X", name: "Global Industrials Ltd" })).toBe(
      "Industrials & Defence"
    );
  });

  it("does not read part of a word as a sector", () => {
    expect(suggestSector({ region: "US", ticker: "X", name: "Embankment Holdings" })).toBeNull();
    // Goldman Sachs is a financial, but its name carries no financial word —
    // the point is that "gold" must not fire on it.
    expect(suggestSector({ region: "US", ticker: "GS", name: "Goldman Sachs Group Inc." })).toBeNull();
    expect(suggestSector({ region: "US", ticker: "X", name: "Gold Fields Ltd" })).toBe(
      "Precious Metals"
    );
  });

  it("prefers a named exposure over a region word in the same name", () => {
    // "Japan" appears in both, and the healthcare fund is the healthcare fund.
    expect(
      suggestSector({ region: "US", ticker: "X", name: "Japan Healthcare Fund" })
    ).toBe("Healthcare");
  });

  it("does not read Singapore Engineering as the Singapore market", () => {
    expect(
      suggestSector({ region: "SG", ticker: "S63", name: "Singapore Technologies Engineering Ltd" })
    ).toBe("Industrials & Defence");
  });
});
