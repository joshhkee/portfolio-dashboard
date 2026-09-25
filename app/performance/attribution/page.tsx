import { prisma } from "@/lib/prisma";
import { fromDbRows } from "@/lib/portfolio-engine";
import { getTickerMetaMaps } from "@/lib/ticker-meta";
import { convertCurrency, currencyForRegion, fetchFxRates, sgdPerUnit } from "@/lib/fx";
import { getSgdRateSeries, sgdRateOn } from "@/lib/fx-history";
import { getSnapshots } from "@/lib/snapshots";
import { contributionAttribution, dayKeyOf } from "@/lib/attribution";
import { getAttributionCloses } from "@/lib/attribution-data";
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
    <div className="screen">
      {/* The grid, and nothing else.

          This page used to spend FOUR rows of prose around a 21-column table:
          an instrument count, a "priced from history" note, a paragraph of cell
          definitions below it, and a cash-reconciliation row below that. All of
          those facts survive — the scope and the cell definitions are on the
          column headers they describe, and the cash check is a line inside the
          panel that already reports how this grid lines up with the other ways
          of measuring the same thing (§8.7). What went was the reading path:
          on a page whose whole content is a table, four rows of text is four
          rows the table cannot have.

          The component is now handed the cash numbers rather than rendering
          them itself, because they are a reconciliation of the SERVER's answer
          (contributions less everything invested, against the hand-maintained
          balances) and the grid is the client's. */}
      {matrix.rows.length === 0 ? (
        <p className="text-sm text-ink-300">
          Contribution attribution appears once the ledger has a transaction and a few months of
          daily snapshots.
        </p>
      ) : (
        <ContributionAttribution
          matrix={matrix}
          cash={{
            gap: Math.abs(cashGap),
            implied: impliedCash,
            held: cashHeld,
            contributed: contributionTotal,
          }}
        />
      )}
    </div>
  );
}
