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

import { priceKey } from "@/lib/prices";
import { currencyForRegion } from "@/lib/fx";

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
  /** Exposure tag, or null when it has never been classified. */
  sector: string | null;
  /** "ETF" | "EQUITY" | ..., as the name lookup reported it. Used for the
   * funds-vs-single-stocks view, which needs no tagging at all. */
  instrumentType: string | null;
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

/** How the instrument type reads in the legend, since "EQUITY" is not a word
 * anyone says out loud. Anything the lookup did not report stays unclassified
 * rather than being called a stock by default. */
const TYPE_LABELS: Record<string, string> = {
  ETF: "Funds (ETF)",
  EQUITY: "Single stocks",
};

/**
 * Exposure by what the instrument IS, which is the axis the sector tags cannot
 * show and the one this portfolio most needs: 61.6% of it sits in funds, and
 * tagging a fund by sector hides that a fund is a basket. Needs no owner input
 * — the name lookup already reports the type — so this view is complete from
 * the first render.
 */
export function instrumentTypeExposure(lines: ExposureLine[]): ExposureBreakdown {
  return groupExposure(lines, (l) =>
    l.instrumentType ? (TYPE_LABELS[l.instrumentType.toUpperCase()] ?? l.instrumentType) : null
  );
}

/** Label for the bucket that folds everything past the named top slices. */
export const OTHER_TAGS_LABEL = "Other tags";

/** How many named slices a donut can carry from the six-colour data palette
 * before it starts repeating colours: five named + "Other tags" fills the
 * palette exactly, and the unclassified slice draws in its own grey. */
export const MAX_NAMED_SLICES = 5;

export interface CappedBreakdown {
  /** What the donut draws: the biggest named buckets, then "Other tags". */
  slices: ExposureBucket[];
  unclassified: UnclassifiedSlice | null;
  /** The named buckets folded into "Other tags", biggest first. Empty when
   * nothing was folded, which is the common case for a small portfolio. */
  folded: ExposureBucket[];
}

/**
 * Cap a breakdown to what a donut can actually show.
 *
 * Ten tags in six colours means `seriesColor()` wraps, so two slices would be
 * drawn identically — the one failure a colour-coded chart cannot survive. The
 * named top slices keep their own colours, everything else is summed into
 * "Other tags" (palette slot six), and the folded buckets are returned so the
 * legend can show them on demand rather than dropping them.
 */
export function capBreakdown(
  breakdown: ExposureBreakdown,
  max: number = MAX_NAMED_SLICES
): CappedBreakdown {
  const named = breakdown.buckets;
  if (named.length <= max + 1) {
    // One spare slot: folding a single bucket into "Other tags" would say less
    // than naming it.
    return { slices: named, unclassified: breakdown.unclassified, folded: [] };
  }

  const top = named.slice(0, max);
  const folded = named.slice(max);
  const other: ExposureBucket = {
    label: OTHER_TAGS_LABEL,
    valueSgd: folded.reduce((sum, b) => sum + b.valueSgd, 0),
    weight: folded.reduce((sum, b) => sum + b.weight, 0),
    positions: folded.reduce((sum, b) => sum + b.positions, 0),
  };
  return { slices: [...top, other], unclassified: breakdown.unclassified, folded };
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
  sectors: Record<string, string>,
  instrumentTypes: Record<string, string> = {}
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
      instrumentType: instrumentTypes[key] ?? null,
    };
  });
}

