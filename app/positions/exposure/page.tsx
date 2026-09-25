import { getOpenPositionsFor } from "@/lib/get-positions";
import { getTickerMetaMaps, suggestedSectorFor } from "@/lib/ticker-meta";
import { priceKey } from "@/lib/prices";
import { fetchFxRates } from "@/lib/fx";
import {
  UNCLASSIFIED_LABEL,
  capBreakdown,
  currencyExposure,
  instrumentTypeExposure,
  sectorExposure,
  toExposureLines,
} from "@/lib/exposure";
import ExposureSummary, { type ExposureView } from "@/components/ExposureSummary";
import SectorTagEditor from "@/components/SectorTagEditor";
import { formatAmount } from "@/components/SignedNumber";

export const dynamic = "force-dynamic";

/**
 * What the portfolio is EXPOSED to, as opposed to what it is worth.
 *
 * Both halves of this page come from the same holding values grouped two ways,
 * and both are strictly derived — nothing here is stored (invariant 1). The
 * only new persisted field is the hand-entered sector tag on TickerMeta, which
 * is reference data like the instrument name next to it.
 *
 * Scope, stated on the page as well as here: the breakdowns cover HOLDINGS,
 * never cash. Cash has no sector, and counting it would flatter every
 * percentage on this page while telling the reader nothing.
 *
 * What USED to be here, and why it is gone: a "how much of the gain was the
 * currency?" split that costed each position at its PURCHASE date's FX rate and
 * reported the difference as a currency gain. The owner's model makes that
 * fiction: cash is exchanged first and shares are bought with the proceeds, so
 * the rate that priced a holding is a conversion the ledger records, not the
 * day the trade happened. Keeping the purchase-date version would have stood
 * a second, contradicting FX story next to the real conversions.
 *
 * Three cuts of the same holdings, not three pages: by hand-entered tag (what
 * was chosen), by instrument type (fund vs single stock, which needs no owner
 * input and so is complete from the first render), and by currency (what the
 * value is denominated in). The first two share one panel because they are the
 * same circle sliced two ways.
 */
export default async function ExposurePage() {
  // FX rates are fetched ONCE and handed to the position loader, rather than
  // letting each fetch its own. Two quotes taken moments apart differ in the
  // fourth decimal, which is enough to make this page's two totals — the
  // holdings breakdown and the P&L split — disagree by a few dollars while
  // both claim to describe the same positions.
  const [meta, rates] = await Promise.all([getTickerMetaMaps(), fetchFxRates()]);

  // Live prices, names and SGD-converted values in one pass — the same helper
  // the holdings pages use, so a position's value here is the value shown
  // there, not a second calculation that could drift.
  const positions = await getOpenPositionsFor(["US", "SG", "HK"], "SGD", rates);

  // --- Sector and currency breakdowns -------------------------------------
  const lines = toExposureLines(
    positions.map((p) => ({
      region: p.region,
      ticker: p.ticker,
      name: p.name,
      valueSgd: p.totalHoldingsConverted,
    })),
    meta.sectors,
    meta.instrumentTypes
  );
  // Capped to what a six-colour palette can draw without repeating a colour;
  // the folded buckets are handed to the legend rather than dropped.
  const sectorRaw = sectorExposure(lines);
  const typeRaw = instrumentTypeExposure(lines);
  const bySector = capBreakdown(sectorRaw);
  const byType = capBreakdown(typeRaw);
  const byCurrency = currencyExposure(lines);

  // The share of the portfolio held through a wrapper rather than as a share —
  // the number the sector tags cannot express, since a tag on a fund labels
  // the fund and not a look-through of what is inside it.
  const fundsWeight = typeRaw.buckets.find((b) => b.label === "Funds (ETF)")?.weight ?? 0;

  // The two groupings of the same holdings, which share one panel behind a
  // toggle (see ExposureSummary), and the currency cut, which gets a panel of its
  // own beside it. Three named objects rather than an array: nothing indexes
  // them by position, so a reader of this file reads the names.
  const sectorView: ExposureView = {
    label: "Sector",
    hint: `${sectorRaw.classified.positions} of ${sectorRaw.positions} holdings tagged`,
    slices: bySector.slices,
    unclassified: bySector.unclassified,
    folded: bySector.folded,
    totalSgd: sectorRaw.totalValueSgd,
    // "Holdings" rather than "Total": the page's scope — these breakdowns
    // cover holdings and never cash — used to be a sentence above the grid,
    // and the ring's own centre is a better place for it than a line of prose
    // that was the first thing on a page of panels. The type view has said
    // "Holdings" since it was written.
    centerLabel: "Holdings",
    note: sectorRaw.unclassified
      ? `${UNCLASSIFIED_LABEL} is not an "Other" sector — it is holdings with no tag yet. Tag them below.`
      : undefined,
  };

  const typeView: ExposureView = {
    label: "Type",
    hint: `${(fundsWeight * 100).toFixed(0)}% of holdings sit inside a fund`,
    slices: byType.slices,
    unclassified: byType.unclassified,
    folded: byType.folded,
    totalSgd: typeRaw.totalValueSgd,
    note: typeRaw.unclassified
      ? `${UNCLASSIFIED_LABEL} here means the lookup reported no instrument type — counted, not named.`
      : undefined,
  };

  // The third cut, and the one that keeps a panel to itself. Its closing
  // sentence is kept — a share of the portfolio denominated in a foreign
  // currency is the whole reading of this ring — but shortened to the one
  // clause that changes the figure's meaning.
  const currencyView: ExposureView = {
    label: "Currency",
    hint: `${((byCurrency.buckets.find((b) => b.label === "SGD")?.weight ?? 0) * 100).toFixed(1)}% denominated in SGD`,
    slices: byCurrency.buckets,
    unclassified: byCurrency.unclassified,
    folded: [],
    totalSgd: byCurrency.totalValueSgd,
    centerLabel: "Holdings",
    note: "The rest is denominated in USD or HKD, so it carries currency risk on top of market risk. The rate that matters is the one the funding cash was converted at, which the deposit ledger records.",
  };

  // Positions with no live quote (some HK tickers aren't covered) are valued at
  // cost basis by withLivePrices, so they stay in the breakdowns and the page
  // says so, rather than presenting a cost basis as a market value.
  const unpriced = positions.filter((p) => p.priceUnavailable);
  const unpricedValueSgd = unpriced.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);

  return (
    // `.screen` plus one grid, and no chrome of this page's own: this is the
    // shape the rest of the site was rewritten to match, so it is the smallest
    // diff here and the largest change everywhere else.
    //
    // What it had instead was `xl:h-[calc(100dvh-13.5rem)]` — a height derived
    // from the viewport with the chrome hand-measured into it (216px: the nav,
    // the "Positions" label, the section tabs, the container's padding, at one
    // width). Every one of those four numbers has since changed, and the two
    // things that made copying it to ten pages a bad idea are both visible in
    // that constant: it names a WIDTH it was measured at, and it silently goes
    // stale when the chrome above it moves. The shell measures the chrome once,
    // for every page, and pages say `flex-1`.
    <div className="screen">
      {/* Two rings on the left, the list that CHANGES them on the right.

          The donuts answer "what am I exposed to"; the tag list beside them is
          the only control on the page that moves those numbers — so they belong
          side by side, and they are: this page has been through three
          arrangements and settled here (see ExposureSummary for the history).
          What is on the left now is TWO rings at once — the sector/type cut
          behind one small toggle, and the currency cut beside it — rather than
          one ring behind a three-way switch. The two questions are different
          ones, and a reader asks them together.

          The left column is `32rem` because that is what a ring panel needs on
          its own terms: a 176px ring plus ~16px of gap leaves the legend ~264px,
          which is a sector name and its two figures with the label still
          truncating rather than the figures wrapping.

          The column scrolls as ONE column rather than each panel scrolling
          itself, and that is the choice that matters here: splitting a fixed
          height between two cards is what makes a card's own caption clip
          mid-sentence at the panel's edge, which reads as a broken panel rather
          than a short window. Two ring panels come to ~520px, so on a 900px
          window nothing scrolls at all; the `overflow-y-auto` is the honest
          answer on a short one. */}
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
          <ExposureSummary sector={sectorView} type={typeView} currency={currencyView} />

          {/* Part of the chart column, not the page: it explains what the
              figures above it are worth, and reads as a footnote to them. */}
          {unpriced.length > 0 && (
            <p className="shrink-0 text-xs text-ink-500">
              {unpriced.length} position{unpriced.length === 1 ? "" : "s"} worth S$
              {formatAmount(unpricedValueSgd)} have no live quote (
              {unpriced.map((p) => p.ticker).join(", ")}) and are counted at cost.
            </p>
          )}
        </div>

        {/* The panel that grows with the portfolio is the one that scrolls:
            `panel-fit` clips here and SectorTagEditor scrolls its own ROWS, so
            its chrome (the untagged bar, the column labels, the closing line)
            stays put and the figures never lose the headings above them. */}
        <section className="panel panel-fit min-w-0 gap-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-xs text-ink-300">Tag the holdings</p>
            {/* The order is stated with its direction now that two holdings share
                a line: biggest first reads across the line and then down. */}
            <p className="text-xs text-ink-500">Biggest holding first, left to right</p>
          </div>
          <SectorTagEditor
            totalSgd={sectorRaw.totalValueSgd}
            positions={[...positions]
              .sort((a, b) => b.totalHoldingsConverted - a.totalHoldingsConverted)
              .map((p) => {
                const key = priceKey(p.region, p.ticker);
                return {
                  region: p.region,
                  ticker: p.ticker,
                  name: p.name,
                  valueSgd: p.totalHoldingsConverted,
                  sector: meta.sectors[key] ?? null,
                  sectorSource: meta.sectorSources[key] ?? null,
                  // The same classifier the writer uses, so the tag a row offers
                  // and the tag a newly seen instrument gets cannot disagree.
                  suggested: suggestedSectorFor({
                    region: p.region,
                    ticker: p.ticker,
                    name: p.name,
                    instrumentType: p.instrumentType,
                  }),
                  instrumentType: p.instrumentType ?? null,
                };
              })}
          />
        </section>
      </div>
    </div>
  );
}
