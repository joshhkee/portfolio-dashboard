// The exposure vocabulary, and the only place that guesses.
//
// Two jobs, deliberately in one module because they must not drift:
//
//   1. `SECTOR_TAGS` — the ten tags the owner chose for this portfolio. The
//      dropdown offers exactly these, and a written tag is validated against
//      them, so the donut can never sprout a category nobody can reproduce.
//   2. `suggestSector()` — a first-draft tag for an instrument nobody has
//      classified yet, so a newly bought stock arrives already labelled and the
//      owner edits rather than types.
//
// The tags are NOT GICS sectors, and that is the point. 61.6% of this portfolio
// is index and sector FUNDS, and a fund has no sector — VOO is not "Technology"
// even though technology is a third of it. So a tag answers the question the
// owner can actually act on — "what did I choose to buy, and how much of my
// money is on that one idea" — rather than claiming a look-through breakdown
// that no free data source provides. The two pairs worth knowing about:
// D05 + XLF are one exposure (financials), and B + SLV are one trade (precious
// metals) with two instruments.
//
// A pure module: no Prisma, no fetch, so the whole suggestion table is testable
// — see tests/sectors.test.ts, which pins the answer for every instrument in
// this portfolio by name.

export const SECTOR_TAGS = [
  "Financials",
  "US Tech",
  "US Broad Market",
  "Precious Metals",
  "Global Broad Market",
  "Healthcare",
  "Consumer",
  "Singapore Market",
  "Japan (Hedged)",
  "Industrials & Defence",
] as const;

export type SectorTag = (typeof SECTOR_TAGS)[number];

const TAG_SET = new Set<string>(SECTOR_TAGS);

/** Whether a written tag is one of the ten. */
export function isSectorTag(value: string): value is SectorTag {
  return TAG_SET.has(value);
}

/** The tags in dropdown order, as a plain array for callers that need to map. */
export function sectorTagList(): string[] {
  return [...SECTOR_TAGS];
}

/**
 * Instruments whose name gives no clue, mapped by hand.
 *
 * Ticker-keyed rather than name-keyed because these are the cases where a rule
 * on the NAME would be wrong or absent: "On Holding AG" is athletic footwear,
 * "IREN Limited" is bitcoin mining turned AI data centres, "Sheng Siong Group
 * Ltd" is a supermarket chain. Keys are `REGION::TICKER` (priceKey's format);
 * a bare ticker is not unique across regions.
 *
 * Two entries are judgement calls, recorded as such:
 *   IREN — the honest label is somewhere between "US Tech" and crypto. It is
 *          filed under US Tech because its revenue is now AI data centres, and
 *          the owner can move it in one click; a separate Crypto tag would be a
 *          singleton covering 3% of the portfolio.
 *   VUG  — large-cap growth is mostly technology, but tagging a broad growth
 *          index as "US Tech" would overstate a bet the owner did not make, so
 *          it is left unclassified rather than guessed into the wrong bucket.
 */
const BY_INSTRUMENT: Record<string, SectorTag> = {
  "SG::D05": "Financials",
  "US::XLF": "Financials",
  "US::VOO": "US Broad Market",
  "US::VT": "Global Broad Market",
  "US::QQQM": "US Tech",
  "US::QQQ": "US Tech",
  "US::DRAM": "US Tech",
  "US::NOW": "US Tech",
  "US::PANW": "US Tech",
  "US::PLTR": "US Tech",
  "US::ZS": "US Tech",
  "US::IREN": "US Tech",
  "US::VHT": "Healthcare",
  "US::IXJ": "Healthcare",
  "US::B": "Precious Metals",
  "US::SLV": "Precious Metals",
  "SG::ES3": "Singapore Market",
  "US::DXJ": "Japan (Hedged)",
  "SG::S63": "Industrials & Defence",
  "US::ONON": "Consumer",
  "SG::OV8": "Consumer",
  "HK::01810": "Consumer",
  "US::PG": "Consumer",
};

/**
 * Name rules, first match wins.
 *
 * Ordered, and the order carries meaning: the fund-shape rules (index names)
 * come before the sector words, so a fund called "Global Healthcare ETF" lands
 * on Healthcare instead of being read as a global index.
 *
 * Two conventions, both learned from a failing test rather than chosen:
 *
 *  - `\b` goes at the START of a pattern, never at the end. "Financial" with a
 *    trailing boundary does not match "Financials", and the first version of
 *    this table missed "Acme Pharmaceuticals" for exactly that reason. Stem
 *    prefixes are what names actually contain.
 *  - the words kept whole are the ones where inflecting changes the meaning.
 *    "gold" matched Goldman Sachs, so it takes a lookahead; "Embankment" is
 *    safe from `\bbank` without one, because the boundary is at the front.
 */
const NAME_RULES: { tag: SectorTag; pattern: RegExp }[] = [
  // Funds whose name states their exposure.
  {
    tag: "Healthcare",
    pattern: /\b(health ?care|pharmac|pharma|biotech|medical|therapeut|diagnostic|hospital|genomic)/i,
  },
  {
    tag: "Financials",
    pattern: /\b(financ|bank|bancorp|insur|reit|asset manage|capital markets|brokerage)/i,
  },
  {
    tag: "Precious Metals",
    // `gold(?!man)` because Goldman Sachs is not a metals exposure.
    pattern: /\b(silver|gold(?!man)|mining|miners|metals|platinum|bullion|copper)/i,
  },
  { tag: "Japan (Hedged)", pattern: /\bjapan/i },
  {
    tag: "Singapore Market",
    pattern: /\b(straits times|singapore).*\b(index|etf|fund|trust|reit)/i,
  },
  {
    tag: "Global Broad Market",
    pattern: /\b(total world|all[- ]world|all[- ]country|world stock|global equity|developed markets?|emerging markets?)/i,
  },
  {
    tag: "US Broad Market",
    pattern: /\b(s&p ?500|total stock market|total market|russell \d{4}|us equity|large[- ]cap)/i,
  },
  { tag: "US Tech", pattern: /\b(nasdaq|semiconductor|memory|software|technolog|tech )/i },
  {
    tag: "Consumer",
    pattern: /\b(consumer|apparel|footwear|retail|supermarket|grocer|foods?|beverages?|household)/i,
  },
  {
    tag: "Industrials & Defence",
    pattern: /\b(industri|defen[cs]e|aerospace|engineering|machinery|electrical|logistics)/i,
  },
];

export interface TaggableInstrument {
  region: string;
  ticker: string;
  /** The resolved instrument name, if one has been cached yet. */
  name?: string | null;
  /** "ETF" | "EQUITY" | anything else the lookup returned. */
  instrumentType?: string | null;
}

/**
 * A first-draft tag for an instrument, or null when nothing is known.
 *
 * Null is a real answer and the common one for anything unfamiliar: an
 * unclassified holding stays visibly unclassified rather than being filed into
 * a bucket nobody chose. The hand map wins over the name rules, because the
 * hand map is where the cases the rules cannot see are recorded.
 */
export function suggestSector(instrument: TaggableInstrument): SectorTag | null {
  const key = `${instrument.region}::${instrument.ticker.toUpperCase()}`;
  const known = BY_INSTRUMENT[key];
  if (known) return known;

  const name = instrument.name ?? "";
  if (!name) return null;

  for (const rule of NAME_RULES) {
    if (rule.pattern.test(name)) return rule.tag;
  }
  return null;
}
