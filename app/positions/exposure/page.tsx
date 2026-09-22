import { getOpenPositionsFor } from "@/lib/get-positions";
import { getTickerMetaMaps } from "@/lib/ticker-meta";
import { priceKey } from "@/lib/prices";
import { fetchFxRates } from "@/lib/fx";
import {
  UNCLASSIFIED_LABEL,
  currencyExposure,
  sectorExposure,
  toExposureLines,
} from "@/lib/exposure";
import ExposureDonut from "@/components/ExposureDonut";
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
    meta.sectors
  );
  const bySector = sectorExposure(lines);
  const byCurrency = currencyExposure(lines);

  // Positions with no live quote (some HK tickers aren't covered) are valued at
  // cost basis by withLivePrices, so they stay in the breakdowns and the page
  // says so, rather than presenting a cost basis as a market value.
  const unpriced = positions.filter((p) => p.priceUnavailable);
  const unpricedValueSgd = unpriced.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const tagged = bySector.coverage;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          {/* No heading of its own: the section tab above already names this
              page, so repeating it here would just be two titles. */}
          <p className="text-xs text-ink-500">
            Holdings only — {lines.length} position{lines.length === 1 ? "" : "s"}, S$
            {formatAmount(bySector.totalValueSgd)}. Cash is excluded: it has no sector, and counting
            it would flatter every share below.
          </p>
        </div>
        <p className="text-xs text-ink-500">
          {tagged >= 1
            ? "Every position is sector-tagged"
            : `${(tagged * 100).toFixed(0)}% of value is sector-tagged`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink-300">By sector</p>
            <p className="text-xs text-ink-500">
              {bySector.classified.positions} of {bySector.positions} tagged
            </p>
          </div>
          <ExposureDonut
            slices={bySector.buckets}
            unclassified={bySector.unclassified}
            totalSgd={bySector.totalValueSgd}
            unclassifiedNote={
              bySector.unclassified
                ? `${UNCLASSIFIED_LABEL} is money in instruments nobody has tagged yet — it is not an "Other" sector. Tag them below and this slice becomes real exposure.`
                : undefined
            }
          />
        </section>

        <section className="panel flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink-300">By currency</p>
            <p className="text-xs text-ink-500">The currency each holding trades in</p>
          </div>
          <ExposureDonut
            slices={byCurrency.buckets}
            unclassified={byCurrency.unclassified}
            totalSgd={byCurrency.totalValueSgd}
          />
          <p className="text-xs text-ink-500">
            Only {((byCurrency.buckets.find((b) => b.label === "SGD")?.weight ?? 0) * 100).toFixed(1)}
            % of the holdings is denominated in the reporting currency. The rest carries a currency
            risk on top of its market risk: its SGD value moves with the exchange rate, and the
            rate that matters is the one the funding cash was CONVERTED at — which your deposit
            ledger records, not the day the shares were bought.
          </p>
        </section>
      </div>

      {unpriced.length > 0 && (
        <p className="text-xs text-ink-500">
          {unpriced.length} position{unpriced.length === 1 ? "" : "s"} worth S$
          {formatAmount(unpricedValueSgd)} have no live quote ({" "}
          {unpriced.map((p) => p.ticker).join(", ")}), so they are counted here at cost basis.
        </p>
      )}

      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink-300">Tag the holdings</p>
          <p className="text-xs text-ink-500">
            Biggest holding first · Enter saves, Escape reverts
          </p>
        </div>
        <SectorTagEditor
          positions={[...positions]
            .sort((a, b) => b.totalHoldingsConverted - a.totalHoldingsConverted)
            .map((p) => ({
              region: p.region,
              ticker: p.ticker,
              name: p.name,
              valueSgd: p.totalHoldingsConverted,
              sector: meta.sectors[priceKey(p.region, p.ticker)] ?? null,
            }))}
        />
      </section>
    </div>
  );
}
