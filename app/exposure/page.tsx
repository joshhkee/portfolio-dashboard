import { prisma } from "@/lib/prisma";
import { fromDbRows } from "@/lib/portfolio-engine";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { getTickerMetaMaps } from "@/lib/ticker-meta";
import { priceKey } from "@/lib/prices";
import { currencySymbol, currencyForRegion, fetchFxRates, sgdPerUnit } from "@/lib/fx";
import { getSgdRateSeries, rateSeriesSpan, sgdRateOn } from "@/lib/fx-history";
import { formatShortDate } from "@/lib/dates";
import {
  UNCLASSIFIED_LABEL,
  currencyExposure,
  fxAttribution,
  sectorExposure,
  sgdCostPerShare,
  toExposureLines,
  type FxPositionInput,
} from "@/lib/exposure";
import ExposureDonut from "@/components/ExposureDonut";
import FxAttributionTable from "@/components/FxAttributionTable";
import SectorTagEditor from "@/components/SectorTagEditor";
import { NativeMoney, formatAmount } from "@/components/SignedNumber";

export const dynamic = "force-dynamic";

const sgd = currencySymbol.SGD;

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: React.ReactNode;
  title?: string;
}) {
  return (
    <div title={title}>
      <p className="text-xs text-ink-300">{label}</p>
      <p className="num text-base font-medium text-ink-100">{value}</p>
    </div>
  );
}

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
 */
export default async function ExposurePage() {
  // FX rates are fetched ONCE and handed to the position loader, rather than
  // letting each fetch its own. Two quotes taken moments apart differ in the
  // fourth decimal, which is enough to make this page's two totals — the
  // holdings breakdown and the P&L split — disagree by a few dollars while
  // both claim to describe the same positions.
  const [rawTransactions, meta, rates, fxSeries] = await Promise.all([
    prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
    getTickerMetaMaps(),
    fetchFxRates(),
    getSgdRateSeries(),
  ]);

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

  // --- Local vs currency P&L ----------------------------------------------
  // Cost per share is rebuilt in SGD using each BUY's own date's FX rate, so
  // "what it cost" means what was actually paid then rather than today's
  // converted equivalent. A purchase older than the rate history falls back to
  // today's rate and is counted, so the page can admit it rather than quietly
  // reporting a currency effect of zero.
  const fallbacks = new Set<string>();
  const costPerShareSgd = sgdCostPerShare(fromDbRows(rawTransactions), (region, date) => {
    const currency = currencyForRegion(region);
    const day = date.toISOString().slice(0, 10);
    const historical = sgdRateOn(fxSeries, currency, day);
    if (historical !== null) return historical;
    fallbacks.add(`${region}@${day}`);
    return sgdPerUnit(currency, rates);
  });

  // Positions with no live quote (some HK tickers aren't covered) fall back to
  // cost basis in withLivePrices, which would make their price P&L exactly
  // zero and their FX P&L meaningless — so they are excluded from the split
  // and reported instead.
  const priced = positions.filter((p) => !p.priceUnavailable);
  const unpriced = positions.filter((p) => p.priceUnavailable);

  const fxRows: FxPositionInput[] = priced.map((p) => {
    const currency = currencyForRegion(p.region);
    const fxNow = sgdPerUnit(currency, rates);
    const key = priceKey(p.region, p.ticker);
    return {
      key,
      region: p.region,
      ticker: p.ticker,
      currency,
      qty: p.qty,
      avgCost: p.avgCost,
      price: p.currentPrice,
      avgCostSgd: costPerShareSgd[key] ?? p.avgCost * fxNow,
      fxNow,
    };
  });
  const attribution = fxAttribution(fxRows);

  const unpricedValueSgd = unpriced.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const rateSpan = rateSeriesSpan(fxSeries);
  const tagged = bySector.coverage;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="text-sm text-ink-300">Exposure</h1>
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
            risk on top of its market risk — see the split below.
          </p>
        </section>
      </div>

      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink-300">How much of the gain was the currency?</p>
          <p className="text-xs text-ink-500">
            {attribution.rows.length} priced position{attribution.rows.length === 1 ? "" : "s"}
            {rateSpan.from && (
              <> · FX rates from {formatShortDate(new Date(`${rateSpan.from}T00:00:00Z`))}</>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-ink-700 pb-3 sm:grid-cols-5">
          <Stat label="Value now" value={`S$${formatAmount(attribution.valueSgd)}`} />
          <Stat
            label="Cost at purchase FX"
            value={`S$${formatAmount(attribution.costSgd)}`}
            title="What the shares still held actually cost in SGD, at the rate on each purchase date."
          />
          <Stat
            label="From prices"
            value={<NativeMoney value={attribution.localPlSgd} symbol={sgd} showPlus />}
            title="P&L from the share prices moving, at today's FX — the figure the holdings page shows."
          />
          <Stat
            label="From currency"
            value={<NativeMoney value={attribution.fxPlSgd} symbol={sgd} showPlus />}
            title="P&L from the exchange rate moving since the shares were bought."
          />
          <Stat
            label="Total P&L"
            value={<NativeMoney value={attribution.totalPlSgd} symbol={sgd} showPlus />}
            title="Price P&L + FX P&L — the SGD gain you would realise selling today."
          />
        </div>

        <FxAttributionTable attribution={attribution} names={meta.names} />

        {attribution.fxShareOfPl !== null && (
          <p className="text-xs text-ink-300">
            Currency accounts for{" "}
            <span className="num">{(attribution.fxShareOfPl * 100).toFixed(1)}%</span> of the SGD
            P&amp;L shown here — positive means the exchange rate helped. A foreign holding can gain
            in its own currency and still lose in SGD, which is exactly what the two columns
            separate.
          </p>
        )}

        {unpriced.length > 0 && (
          <p className="text-xs text-ink-500">
            Excluded: {unpriced.length} position{unpriced.length === 1 ? "" : "s"} worth S$
            {formatAmount(unpricedValueSgd)} with no live quote ({unpriced
              .map((p) => p.ticker)
              .join(", ")}
            ) — priced at cost basis, so neither column could be measured honestly.
          </p>
        )}

        {fallbacks.size > 0 && (
          <p className="text-xs text-ink-500">
            {fallbacks.size} purchase{fallbacks.size === 1 ? "" : "s"} predate the available FX
            history, so {fallbacks.size === 1 ? "it was" : "they were"} costed at today&apos;s rate.
            The currency effect for those is understated rather than invented.
          </p>
        )}
      </section>

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
