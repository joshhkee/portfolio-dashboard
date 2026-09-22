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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* No heading of its own: the section tab above already names this
            page, so repeating it here would just be two titles. The coverage
            figure that used to sit opposite was stating what the sector panel
            already says under its own caption, so it is only stated once. */}
        <div>
          <p className="text-xs text-ink-500">
            Holdings only — {lines.length} position{lines.length === 1 ? "" : "s"}, S$
            {formatAmount(sectorRaw.totalValueSgd)}. Cash is excluded: it has no sector.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </div>

      {unpriced.length > 0 && (
        <p className="text-xs text-ink-500">
          {unpriced.length} position{unpriced.length === 1 ? "" : "s"} worth S$
          {formatAmount(unpricedValueSgd)} have no live quote (
          {unpriced.map((p) => p.ticker).join(", ")}) and are counted at cost.
        </p>
      )}

      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink-300">Tag the holdings</p>
          <p className="text-xs text-ink-500">Biggest holding first</p>
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
  );
}
