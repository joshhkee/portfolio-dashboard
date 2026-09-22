import { prisma } from "@/lib/prisma";
import { fromDbRows } from "@/lib/portfolio-engine";
import { getTickerMetaMaps } from "@/lib/ticker-meta";
import { convertCurrency, currencyForRegion, fetchFxRates, sgdPerUnit } from "@/lib/fx";
import { getSgdRateSeries, sgdRateOn } from "@/lib/fx-history";
import { getSnapshots } from "@/lib/snapshots";
import { contributionAttribution, dayKeyOf } from "@/lib/attribution";
import { getAttributionCloses } from "@/lib/attribution-data";
import { formatShortDate } from "@/lib/dates";
import { formatAmount } from "@/components/SignedNumber";
import ContributionAttribution from "@/components/ContributionAttribution";

export const dynamic = "force-dynamic";

/** CashBalance stores one row per currency; the ledger's regions map onto them. */
const CURRENCY_TO_REGION: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };

/**
 * Contribution attribution — which holding, and which period, produced the
 * result.
 *
 * The whole grid is computed server-side for ALL history and sliced on the
 * client, the same trade the other charts make: recomputing per range would
 * need a fresh set of multi-year price series for every ticker on every button
 * press.
 *
 * Every figure is derived by replaying the ledger (invariant 1) and nothing
 * here is stored. Two honest caveats are surfaced on the page rather than
 * buried: instruments Yahoo has no price history for are valued at cost (so
 * they contribute exactly their cash flow, not a fabricated gain), and any
 * purchase older than the FX history is costed at today's rate and counted.
 */
export default async function AttributionPage() {
  const [rawTransactions, meta, rates, fxSeries, snapshots] = await Promise.all([
    prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
    getTickerMetaMaps(),
    fetchFxRates(),
    getSgdRateSeries(),
    getSnapshots(),
  ]);

  const transactions = fromDbRows(rawTransactions);

  // Every instrument the ledger has EVER traded — a fully closed position still
  // needs its month-end values for the periods it was held.
  const instruments = Array.from(
    new Map(
      transactions.map((t) => [`${t.region}::${t.ticker}`, { region: t.region, ticker: t.ticker }])
    ).values()
  );
  const closes = await getAttributionCloses(instruments);

  const matrix = contributionAttribution(
    {
      transactions,
      closes,
      names: meta.names,
      snapshots,
      sgdRate: (region, day) => {
        const currency = currencyForRegion(region);
        const historical = sgdRateOn(fxSeries, currency, day);
        return historical === null
          ? { rate: sgdPerUnit(currency, rates), fallback: true }
          : { rate: historical, fallback: false };
      },
    },
    dayKeyOf(new Date())
  );

  // Cash reconciliation, reported rather than assumed. The grid never touches
  // cash, but the question "why doesn't this reconcile with the dashboard
  // total?" is guaranteed, so the answer is measured here: what the ledger says
  // should still be in the account (contributions, less everything invested) vs
  // what the account actually holds. CashBalance is hand-maintained by design
  // (invariant 2), so a gap here is the two drifting apart — not an error in the
  // attribution, which is why it is stated and not silently "fixed".
  const [contributions, cashRows] = await Promise.all([
    prisma.contribution.findMany({ select: { amount: true } }),
    prisma.cashBalance.findMany(),
  ]);
  const contributionTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
  const impliedCash = contributionTotal - matrix.netInvestedTotal;
  const cashHeld = cashRows.reduce(
    (sum, row) => sum + convertCurrency(row.balance, CURRENCY_TO_REGION[row.currency] ?? "SG", "SGD", rates),
    0
  );
  const cashGap = impliedCash - cashHeld;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="text-sm text-ink-300">Attribution</h1>
          <p className="text-xs text-ink-500">
            {matrix.rows.length} instrument{matrix.rows.length === 1 ? "" : "s"} ever traded,
            measured from {formatShortDate(new Date(`${matrix.baselineDay}T00:00:00Z`))} — the day
            before the first recorded trade.
          </p>
        </div>
        <p className="text-xs text-ink-500">
          Positions only · no fees · nothing stored
        </p>
      </div>

      {matrix.rows.length === 0 ? (
        <p className="text-sm text-ink-300">
          Contribution attribution appears once the ledger has a transaction and a few months of
          daily snapshots.
        </p>
      ) : (
        <ContributionAttribution matrix={matrix} />
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xs text-ink-500">
          Cash check: the ledger says S${formatAmount(impliedCash)} should still be uninvested
          (S${formatAmount(contributionTotal)} contributed, less what was spent on trades), while the
          recorded balances hold S${formatAmount(cashHeld)} — a difference of S$
          {formatAmount(Math.abs(cashGap))}. Cash is hand-maintained here, so this is the ledger and
          the balances drifting apart rather than an error in the grid, which never touches cash.
        </p>
      </div>

      {(matrix.unpriced.length > 0 || matrix.fxFallbacks > 0) && (
        <div className="flex flex-col gap-1">
          {matrix.unpriced.length > 0 && (
            <p className="text-xs text-ink-500">
              Valued at cost, because the price source has no history for them:{" "}
              {matrix.unpriced.map((k) => k.split("::")[1]).join(", ")}. A position with no price
              series contributes exactly its cash flow — a zero gain — rather than a measured one.
            </p>
          )}
          {matrix.fxFallbacks > 0 && (
            <p className="text-xs text-ink-500">
              {matrix.fxFallbacks} date
              {matrix.fxFallbacks === 1 ? "" : "s"} predate the available FX history and were costed
              at today&apos;s rate, so the currency effect on those amounts is understated rather
              than invented.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
