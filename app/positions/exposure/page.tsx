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
import ExposureDonut from "@/components/ExposureDonut";
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

  const views: ExposureView[] = [
    {
      label: "By sector",
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
    },
    {
      label: "By type",
      hint: `${(fundsWeight * 100).toFixed(0)}% of holdings sit inside a fund`,
      slices: byType.slices,
      unclassified: byType.unclassified,
      folded: byType.folded,
      totalSgd: typeRaw.totalValueSgd,
      note: typeRaw.unclassified
        ? `${UNCLASSIFIED_LABEL} here means the lookup reported no instrument type — counted, not named.`
        : undefined,
    },
  ];

  // Positions with no live quote (some HK tickers aren't covered) are valued at
  // cost basis by withLivePrices, so they stay in the breakdowns and the page
  // says so, rather than presenting a cost basis as a market value.
  const unpriced = positions.filter((p) => p.priceUnavailable);
  const unpricedValueSgd = unpriced.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Charts on the left, the list that CHANGES them on the right.

          The three donuts answer "what am I exposed to"; the tag list under them
          is the only control on the page that moves those numbers. They were a
          full-width row of charts with the list beneath it, which spent the
          page's width twice: the list is the tallest panel here, and a chart
          panel stretched across 1200px is mostly the ring's two neighbours.
          Side by side, each column is the size of its own content.

          The left column is `32rem` because that is what the donut panel needs
          on its own terms: a 192px ring plus ~16px of gap leaves the legend
          ~264px, which is a sector name and its two figures with the label
          still truncating rather than the figures wrapping.

          `xl` (1280) is where both columns can be honest at once. The list's
          five tracks want ~560px of panel, this column wants 512, and the
          gutters take the rest — 1100 of content fits with room to spare at
          1280 and does not at 1024. Below `xl` the page keeps the arrangement
          it had: the two chart panels across the top (`lg:grid-cols-2`) and the
          list full width underneath.

          From `xl` the grid is also the height of the screen less the chrome
          above it, so the page itself never scrolls: the chart column on the
          left, one panel on the right, and whatever outgrows its compartment
          scrolls INSIDE it (the tag list always does — it is the only panel here
          that grows with the portfolio). `13.5rem` is that chrome, measured
          rather than guessed: the nav, the "Positions" label, the section tabs
          and the container's own padding came to 216px at a 1296px width, and
          none of those four change with the width.

          The chart column scrolls as ONE column rather than each card
          scrolling itself, and that is the choice that matters here: splitting
          a fixed height between two cards is what makes a card's own caption
          clip mid-sentence at the panel's edge, which reads as a broken panel
          rather than a short window. As a column, the cards keep their natural
          height and the shortfall is a single scrollbar on a window under about
          880px tall — above that, nothing scrolls at all. */}
      <div className="grid grid-cols-1 gap-4 xl:h-[calc(100dvh-13.5rem)] xl:min-h-0 xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] xl:items-stretch">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 xl:flex xl:min-h-0 xl:flex-col xl:overflow-y-auto">
          <ExposureSummary views={views} />

          <section className="panel flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-ink-300">By currency</p>
              <p className="text-xs text-ink-500">What each holding trades in</p>
            </div>
            <ExposureDonut
              slices={byCurrency.buckets}
              unclassified={byCurrency.unclassified}
              totalSgd={byCurrency.totalValueSgd}
            />
            <p className="text-xs text-ink-500">
              Only {((byCurrency.buckets.find((b) => b.label === "SGD")?.weight ?? 0) * 100).toFixed(1)}
              % is denominated in SGD, so the rest carries currency risk on top of market risk. The
              rate that matters is the one the funding cash was converted at — the deposit ledger
              records that, not the day the shares were bought.
            </p>
          </section>

          {/* Part of the chart column, not the page: it explains what the
              figures above it are worth, and reads as a footnote to them. */}
          {unpriced.length > 0 && (
            <p className="shrink-0 text-xs text-ink-500 lg:col-span-2">
              {unpriced.length} position{unpriced.length === 1 ? "" : "s"} worth S$
              {formatAmount(unpricedValueSgd)} have no live quote (
              {unpriced.map((p) => p.ticker).join(", ")}) and are counted at cost.
            </p>
          )}
        </div>

        {/* `overflow-hidden` rather than a scrollbar: the panel's own chrome
            (title, the untagged bar, the column labels, the closing line) stays
            put and the ROWS scroll, which is what makes the labels read as a
            header instead of scrolling away from their columns. */}
        <section className="panel flex min-w-0 flex-col gap-4 overflow-hidden p-5 xl:min-h-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink-300">Tag the holdings</p>
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
