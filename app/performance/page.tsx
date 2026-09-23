import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { Percent, formatAmount } from "@/components/SignedNumber";
import { currencySymbol, convertCurrency, fetchFxRates } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import { xirr } from "@/lib/xirr";
import { getSnapshots, maxDrawdown } from "@/lib/snapshots";
import {
  annualizeReturn,
  portfolioDailyReturns,
  timeWeightedReturn,
  yearlyReturns,
} from "@/lib/performance";
import {
  RISK_FREE_RATE,
  annualizedVolatility,
  concentration,
  largestMove,
  rollingAnnualizedReturn,
  sharpeRatio,
} from "@/lib/risk";
import { BENCHMARKS, getBenchmarkCloses } from "@/lib/benchmarks";
import { alignCloses, priceKey } from "@/lib/prices";
import PortfolioPerformance from "@/components/PortfolioPerformance";
import YearlyReturnsTable from "@/components/YearlyReturnsTable";
import RiskPanel from "@/components/RiskPanel";

export const dynamic = "force-dynamic";

const sgd = currencySymbol.SGD;
const CURRENCY_TO_REGION: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };

/**
 * Returns and risk, over the whole history.
 *
 * This is the page that answers "how am I doing, and is that good" — it holds
 * the statistics that used to be crammed into the dashboard's hero line and the
 * risk panel that sat below the fold of a page whose real job is "what is it
 * worth today". Nothing here is a new number; it is the same arithmetic with
 * the room to show its context (the rolling line, the calendar years, the
 * benchmark regression).
 *
 * Every statistic is computed over ALL history on purpose. Volatility and the
 * Sharpe ratio are estimates, and a one-month window makes them swing wildly
 * without meaning anything — the rolling line inside the risk panel is what
 * shows how the statistic has MOVED over time, which is the question a range
 * picker would be pretending to answer.
 */
export default async function PerformancePage() {
  // Every read is a round trip to a remote pooler, so the whole set is issued
  // together rather than awaited one at a time.
  const [contributions, cashRows, rates, snapshots, transactions] = await Promise.all([
    prisma.contribution.findMany({ orderBy: { date: "asc" } }),
    prisma.cashBalance.findMany(),
    fetchFxRates(),
    getSnapshots(),
    prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
  ]);

  const positions = await getOpenPositionsFor(["US", "SG", "HK"], "SGD", rates, transactions);
  const holdingsValueSgd = positions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);

  let cashTotalSgd = 0;
  for (const row of cashRows) {
    cashTotalSgd += convertCurrency(row.balance, CURRENCY_TO_REGION[row.currency], "SGD", rates);
  }
  const totalPortfolioValue = holdingsValueSgd + cashTotalSgd;

  // Money-weighted return: every contribution as money in, today's total as the
  // final value. Moves with the deposit schedule.
  const cashflows: { amount: number; date: Date }[] = contributions.map((c) => ({
    amount: -c.amount,
    date: c.date,
  }));
  if (cashflows.length > 0) {
    cashflows.push({ amount: totalPortfolioValue, date: new Date() });
  }
  const annualizedReturn = xirr(cashflows);

  // Time-weighted return: contribution timing removed entirely, so this is the
  // number comparable to an index. With monthly deposits from five people the
  // two differ noticeably, which is exactly why both are shown side by side.
  const twrTotal = timeWeightedReturn(snapshots);
  const twrAnnualized =
    twrTotal !== null && snapshots.length >= 2
      ? annualizeReturn(twrTotal, snapshots[0].date, snapshots[snapshots.length - 1].date)
      : null;

  const dailyReturns = portfolioDailyReturns(snapshots);
  const volatility = annualizedVolatility(dailyReturns);
  const sharpe = sharpeRatio(twrAnnualized, volatility);
  const maxDrawdownPct = maxDrawdown(snapshots);
  // Returns are between consecutive snapshots, so they align with the series
  // from the second one onwards.
  const biggestDay = largestMove(
    dailyReturns,
    snapshots.slice(1).map((s) => s.date)
  );
  const rollingPoints = rollingAnnualizedReturn(snapshots).flatMap((value, i) =>
    value === null ? [] : [{ date: snapshots[i].date, value }]
  );

  const concentrationStats = concentration(positions.map((p) => p.totalHoldingsConverted));
  const riskSlices = positions.map((p) => ({
    key: priceKey(p.region, p.ticker),
    ticker: p.ticker,
    name: p.name,
    value: p.totalHoldingsConverted,
    weight: p.portfolioPct,
  }));

  // Benchmark indices, fetched server-side and aligned 1:1 with the snapshot
  // series so the client can slice both by the same offset when the range
  // changes. Cached for 15 minutes, so the cost is bounded by the number of
  // INDICES, never by the number of days or positions.
  const benchmarkCloses =
    snapshots.length >= 2
      ? await Promise.all(BENCHMARKS.map((b) => getBenchmarkCloses(b.symbol)))
      : [];
  const snapshotDates = snapshots.map((s) => s.date);
  const benchmarkSeries: Record<string, (number | null)[]> = {};
  for (let i = 0; i < BENCHMARKS.length; i++) {
    benchmarkSeries[BENCHMARKS[i].key] = alignCloses(snapshotDates, benchmarkCloses[i] ?? {});
  }

  const yearReturns = yearlyReturns(snapshots);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-ink-500">
          {annualizedReturn !== null ? (
            <>
              <span className="text-ink-100">XIRR</span>: what your money earned.{" "}
              <span className="text-ink-100">TWR</span>: how the strategy did, deposit timing
              removed — the one to compare against an index.
            </>
          ) : (
            "Not enough history yet to annualise anything."
          )}
        </p>
        <p className="text-xs text-ink-500">
          {snapshots.length} daily snapshots
          {snapshots.length > 0 &&
            ` · ${formatShortDate(new Date(snapshots[0].date))} – ${formatShortDate(
              new Date(snapshots[snapshots.length - 1].date)
            )}`}
        </p>
      </div>

      {/* The statistics, up front and in one row: what it returned (two ways),
          how much it moved to get there, and the worst it drew down. */}
      <div className="panel flex flex-wrap items-start gap-x-10 gap-y-4 p-6">
        <Stat
          label="XIRR (ann., money-weighted)"
          title="Money-weighted: counts when each contribution landed."
          value={annualizedReturn !== null ? <Percent value={annualizedReturn} /> : "—"}
        />
        <Stat
          label="TWR (ann., time-weighted)"
          title="Time-weighted: deposit timing removed, so it reflects the strategy."
          value={twrAnnualized !== null ? <Percent value={twrAnnualized} /> : "—"}
        />
        <Stat
          label="Volatility (ann.)"
          title="How much the daily value swings, annualised."
          value={volatility !== null ? `${(volatility * 100).toFixed(1)}%` : "—"}
        />
        <Stat
          label="Sharpe"
          title={`Excess return over a ${(RISK_FREE_RATE * 100).toFixed(1)}% risk-free rate, per unit of volatility.`}
          value={sharpe !== null ? sharpe.toFixed(2) : "—"}
          tone={sharpe !== null && sharpe > 0 ? "gain" : sharpe !== null ? "loss" : undefined}
        />
        <Stat
          label="Max drawdown"
          title="The worst fall from a peak to the trough that followed."
          value={maxDrawdownPct !== null ? `${(maxDrawdownPct * 100).toFixed(1)}%` : "—"}
          tone="loss"
        />
        <Stat
          label="Largest day"
          title={
            biggestDay
              ? `${formatShortDate(new Date(biggestDay.date))} — the single biggest one-day move.`
              : undefined
          }
          value={
            biggestDay
              ? `${biggestDay.value >= 0 ? "+" : ""}${(biggestDay.value * 100).toFixed(2)}%`
              : "—"
          }
          tone={biggestDay ? (biggestDay.value >= 0 ? "gain" : "loss") : undefined}
        />
        <Stat
          label="Holdings value"
          title="What the concentration figures below are shares of."
          // Neutral: a value held is not a gain. Only the return and risk
          // figures in this row carry a colour.
          value={`${sgd}${formatAmount(holdingsValueSgd)}`}
        />
      </div>

      <PortfolioPerformance
        data={snapshots}
        benchmarks={BENCHMARKS}
        benchmarkSeries={benchmarkSeries}
      />

      {concentrationStats && snapshots.length >= 2 ? (
        <RiskPanel
          concentration={concentrationStats}
          slices={riskSlices.slice(0, 8)}
          hiddenCount={Math.max(0, riskSlices.length - 8)}
          volatility={volatility}
          sharpe={sharpe}
          annualReturn={twrAnnualized}
          riskFreeRate={RISK_FREE_RATE}
          largestMove={biggestDay}
          rolling={rollingPoints}
          rollingWindowDays={365}
          windowLabel={`${formatShortDate(new Date(snapshots[0].date))} – ${formatShortDate(
            new Date(snapshots[snapshots.length - 1].date)
          )}`}
          days={snapshots.length}
          totalSgd={holdingsValueSgd}
        />
      ) : null}

      <YearlyReturnsTable years={yearReturns} />
    </div>
  );
}

/**
 * One figure in the statistics row.
 *
 * The `title` is not decoration: every number here is an estimate with a
 * definition, and a reader who wants to know which definition gets it on
 * hover rather than in a footnote they will not scroll to.
 */
function Stat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "gain" | "loss";
  title?: string;
}) {
  return (
    <div title={title}>
      <p className="text-xs text-ink-300">{label}</p>
      <p
        className={`num mt-1 text-xl font-medium ${
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
