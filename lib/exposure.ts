// Exposure analytics — the "what am I actually exposed to?" lens.
//
// Two questions, both answered by grouping the same holding values two
// different ways:
//
//   Sector   — how much of my money sits in banks, semis, index funds. No free
//              data source classifies these instruments, so the tag is
//              HAND-ENTERED per instrument (TickerMeta.sector) and an untagged
//              holding stays visibly unclassified rather than being folded
//              into an "Other" bucket that would overstate how much is known.
//   Currency — how much is denominated in SGD, USD and HKD, and how much of
//              the SGD P&L came from the currency rather than the shares.
//
// Everything here is PURE. Fetching (live prices, historical FX) lives in the
// page and in lib/fx-history.ts, for the same reason lib/risk.ts is pure:
// these numbers get read as facts about the portfolio, so each definition has
// exactly one implementation that can be tested against known arithmetic.
//
// Scope note: both breakdowns cover HOLDINGS only, never cash. That matches
// the concentration panel, which the owner already reads this way — cash is
// not a position, it has no sector, and folding it in would flatter every
// exposure percentage.

import { computeLedger, type RawTransaction } from "@/lib/portfolio-engine";
import { priceKey } from "@/lib/prices";
import { currencyForRegion, type Currency } from "@/lib/fx";

/** Label for the explicit "nobody has tagged this yet" slice. */
export const UNCLASSIFIED_LABEL = "Unclassified";

/** One held instrument, valued in SGD, ready to be grouped. */
export interface ExposureLine {
  /** Compound "REGION::TICKER" (invariant 4 — a bare ticker is not unique). */
  key: string;
  region: string;
  ticker: string;
  name: string | null;
  /** Holding value in SGD. */
  valueSgd: number;
  /** Hand-entered exposure tag, or null when it has never been classified. */
  sector: string | null;
}

export interface ExposureBucket {
  label: string;
  valueSgd: number;
  /**
   * Share of TOTAL holdings value, 0..1 — not of the classified part. So the
   * named buckets plus the unclassified slice always sum to 1, and a bucket's
   * percentage means the same thing whether or not everything is tagged.
   */
  weight: number;
  /** How many positions landed in this bucket. */
  positions: number;
}

export interface ExposureSlice {
  valueSgd: number;
  weight: number;
  positions: number;
}

/**
 * The untagged remainder. Carries its own display label so no caller has to
 * invent a name for it (and so two callers can't invent two different ones).
 */
export interface UnclassifiedSlice extends ExposureSlice {
  label: string;
}

export interface ExposureBreakdown {
  /** Named buckets, largest first. Never contains the unclassified slice. */
  buckets: ExposureBucket[];
  /** Null when everything is tagged. */
  unclassified: UnclassifiedSlice | null;
  totalValueSgd: number;
  positions: number;
  classified: ExposureSlice;
  /** Classified value / total value, 0..1. 1 means the named buckets ARE the pie. */
  coverage: number;
}

/**
 * Tags are hand-typed, so "banks", "Banks " and "BANKS" must land in one
 * bucket — otherwise a single keystroke difference silently splits an exposure
 * in two and halves its apparent weight.
 */
function normalizeTag(tag: string | null | undefined): string | null {
  const trimmed = (tag ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Group holding values by a tag, keeping an explicit unclassified slice.
 *
 * Weights are taken against the total including unclassified holdings, which
 * is the only denominator that lets the reader say "12% of my money is in
 * banks" without first having to know how much is tagged.
 */
export function groupExposure(
  lines: ExposureLine[],
  tagOf: (line: ExposureLine) => string | null
): ExposureBreakdown {
  // A zero-value row is not a holding (same rule as concentration()).
  const holdings = lines.filter((l) => Number.isFinite(l.valueSgd) && l.valueSgd > 0);
  const totalValueSgd = holdings.reduce((sum, l) => sum + l.valueSgd, 0);

  // Largest first, which also decides how a bucket is SPELLED: the biggest
  // position in it supplies the label, so the dominant name wins over whoever
  // happened to be typed first.
  const ordered = [...holdings].sort((a, b) => b.valueSgd - a.valueSgd);

  const byKey = new Map<string, ExposureBucket>();
  let unclassifiedValueSgd = 0;
  let unclassifiedPositions = 0;

  for (const line of ordered) {
    const tag = normalizeTag(tagOf(line));
    if (tag === null) {
      unclassifiedValueSgd += line.valueSgd;
      unclassifiedPositions++;
      continue;
    }
    const key = tag.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.valueSgd += line.valueSgd;
      existing.positions++;
    } else {
      byKey.set(key, { label: tag, valueSgd: line.valueSgd, weight: 0, positions: 1 });
    }
  }

  const share = (value: number) => (totalValueSgd > 0 ? value / totalValueSgd : 0);
  const buckets = Array.from(byKey.values())
    .map((b) => ({ ...b, weight: share(b.valueSgd) }))
    .sort((a, b) => b.valueSgd - a.valueSgd);

  const classifiedValueSgd = totalValueSgd - unclassifiedValueSgd;
  return {
    buckets,
    unclassified:
      unclassifiedPositions === 0
        ? null
        : {
            label: UNCLASSIFIED_LABEL,
            valueSgd: unclassifiedValueSgd,
            weight: share(unclassifiedValueSgd),
            positions: unclassifiedPositions,
          },
    totalValueSgd,
    positions: holdings.length,
    classified: {
      valueSgd: classifiedValueSgd,
      weight: share(classifiedValueSgd),
      positions: holdings.length - unclassifiedPositions,
    },
    coverage: share(classifiedValueSgd),
  };
}

/** Exposure by hand-entered sector tag. */
export function sectorExposure(lines: ExposureLine[]): ExposureBreakdown {
  return groupExposure(lines, (l) => l.sector);
}

/**
 * Exposure by the currency each instrument actually trades in. Every region
 * maps to a currency, so this breakdown is always complete — it exists mainly
 * to show what share of the reporting currency (SGD) the portfolio is really
 * exposed to.
 */
export function currencyExposure(lines: ExposureLine[]): ExposureBreakdown {
  return groupExposure(lines, (l) => currencyForRegion(l.region));
}

/**
 * Attach sector tags (keyed by compound region::ticker) to valued positions.
 *
 * A missing map entry means "never classified", not "Other" — the distinction
 * is the whole point of the unclassified slice, so it is made here once.
 */
export function toExposureLines(
  positions: {
    region: string;
    ticker: string;
    name: string | null;
    valueSgd: number;
  }[],
  sectors: Record<string, string>
): ExposureLine[] {
  return positions.map((p) => {
    const key = priceKey(p.region, p.ticker);
    return {
      key,
      region: p.region,
      ticker: p.ticker,
      name: p.name,
      valueSgd: p.valueSgd,
      sector: sectors[key] ?? null,
    };
  });
}

export interface FxPositionInput {
  key: string;
  region: string;
  ticker: string;
  currency: Currency;
  qty: number;
  /** Weighted-average cost per share, in the position's own currency. */
  avgCost: number;
  /** Live price per share, in the position's own currency. */
  price: number;
  /**
   * SGD paid per share for the shares STILL HELD, blended across purchases at
   * each purchase date's own FX rate — see sgdCostPerShare().
   */
  avgCostSgd: number;
  /** SGD per one unit of `currency` today. */
  fxNow: number;
}

export interface FxAttributionRow extends FxPositionInput {
  /** Market value in SGD at today's rate. */
  valueSgd: number;
  /** What the held shares actually cost, in SGD, at their purchase rates. */
  costSgd: number;
  /** P&L from the price moving, measured at today's FX. */
  localPlSgd: number;
  /** P&L from the currency moving since the shares were bought. */
  fxPlSgd: number;
  /** localPlSgd + fxPlSgd — the P&L actually bankable if sold today. */
  totalPlSgd: number;
  /** SGD per unit of the currency at the (blended) purchase dates. */
  fxAtCost: number;
  /** Share of this row's P&L that came from currency; null when P&L is 0. */
  fxShareOfPl: number | null;
}

export interface FxAttribution {
  rows: FxAttributionRow[];
  valueSgd: number;
  costSgd: number;
  localPlSgd: number;
  fxPlSgd: number;
  totalPlSgd: number;
  /**
   * What the holdings page reports, exactly: the local component, because that
   * page converts cost at TODAY'S rate.
   */
  headlinePlSgd: number;
  /** totalPlSgd - headlinePlSgd — the FX effect the holdings page leaves out. */
  differenceSgd: number;
  /** Share of the SGD P&L explained by currency; null when there is no P&L. */
  fxShareOfPl: number | null;
}

/**
 * Split each position's SGD P&L into the part the PRICES produced and the part
 * the CURRENCY produced.
 *
 * The holdings page converts a position's native P&L at today's FX rate. That
 * is an approximation: the shares were bought at the FX rate of their purchase
 * date, so between then and now the currency has independently moved the SGD
 * cost. This decomposes
 *
 *     total = value(price, fxNow) - cost(price, fxAtPurchase)
 *
 * into `localPlSgd` (price move × today's FX) and `fxPlSgd` =
 * `qty × avgCost × (fxNow − fxAtCost)`.
 *
 * The FX term is computed from that closed form rather than as the residual
 * `total − local`, because the two differ only in the last floating-point
 * places — and for an SGD position, where `fxNow === fxAtCost`, the closed form
 * is EXACTLY zero while the residual lands on ±1e-12 and renders as
 * "-S$0.00". A decomposition is only legible if its zeroes look like zeroes.
 * A test pins the identity that makes it complete: the residual of total − local
 * equals this term, so nothing is left unexplained.
 *
 * A currency that hasn't moved yields exactly 0, so an SGD-denominated
 * position never shows a phantom FX gain.
 */
export function fxAttribution(rows: FxPositionInput[]): FxAttribution {
  const out: FxAttributionRow[] = rows.map((row) => {
    const valueSgd = row.qty * row.price * row.fxNow;
    const costSgd = row.qty * row.avgCostSgd;
    // The holdings page's number: native P&L converted at today's rate.
    const localPlSgd = row.qty * (row.price - row.avgCost) * row.fxNow;
    const totalPlSgd = valueSgd - costSgd;
    const fxAtCost = row.avgCost === 0 ? row.fxNow : row.avgCostSgd / row.avgCost;
    const fxPlSgd = row.qty * row.avgCost * (row.fxNow - fxAtCost);

    return {
      ...row,
      valueSgd,
      costSgd,
      localPlSgd,
      fxPlSgd,
      totalPlSgd,
      fxAtCost,
      fxShareOfPl: totalPlSgd === 0 ? null : fxPlSgd / totalPlSgd,
    };
  });

  const sum = (pick: (r: FxAttributionRow) => number) => out.reduce((s, r) => s + pick(r), 0);
  const localPlSgd = sum((r) => r.localPlSgd);
  const fxPlSgd = sum((r) => r.fxPlSgd);
  const totalPlSgd = sum((r) => r.totalPlSgd);

  return {
    rows: out,
    valueSgd: sum((r) => r.valueSgd),
    costSgd: sum((r) => r.costSgd),
    localPlSgd,
    fxPlSgd,
    totalPlSgd,
    headlinePlSgd: localPlSgd,
    // The FX term, so the caption's "difference of …" always equals the FX
    // column it sits under rather than being a hair off it.
    differenceSgd: fxPlSgd,
    fxShareOfPl: totalPlSgd === 0 ? null : fxPlSgd / totalPlSgd,
  };
}

/**
 * Weighted-average SGD cost per share for each open position, using each
 * purchase's OWN date's FX rate.
 *
 * The trick is that no second average is written: feeding computeLedger() a
 * copy of the ledger whose prices are already in SGD makes the engine's
 * existing weighted-average replay do the blending, and its "average cost
 * carries forward through a Sell" behaviour is exactly right here too — the
 * shares still held keep the blended purchase cost of the shares still held.
 *
 * `sgdRateAt` returning 0 or a non-finite value for a date would poison the
 * average, so those are treated as "no rate" by the caller, which supplies
 * today's rate as the fallback and counts how many positions needed it.
 */
export function sgdCostPerShare(
  transactions: RawTransaction[],
  sgdRateAt: (region: string, date: Date) => number
): Record<string, number> {
  const converted = transactions.map((t) => ({
    ...t,
    price: t.price * sgdRateAt(t.region, t.date),
  }));

  const { openPositions } = computeLedger(converted);
  const out: Record<string, number> = {};
  for (const p of openPositions) {
    out[priceKey(p.region, p.ticker)] = p.avgCost;
  }
  return out;
}
