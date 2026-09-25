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
import PerformanceViews from "@/components/PerformanceViews";
import type { RiskPanelProps } from "@/components/RiskPanel";

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
    <div className="screen">
      {/* The whole page in two rows: the figures, then the panel they describe.

          These statistics were a `p-6` panel three lines tall (~150px), with a
          glossary paragraph above it explaining XIRR and TWR, and the three
          chart panels stacked below it — so the page was four screens of
          scrolling, of which you were reading one at a time.

          The glossary is not gone: "what your money earned" and "how the
          strategy did, deposit timing removed" are the `title` of the two
          figures they define, which is where a reader asks the question
          (DESIGN.md §8.1) — and one line of it stays on the page as the
          snapshot count and the window it covers. */}
      <div className="page-bar">
        <dl className="stat-strip">
          <Stat
            label="XIRR"
            title={
              annualizedReturn !== null
                ? "Money-weighted annualised return: what your money earned, counting when each contribution landed."
                : "Not enough history yet to annualise anything."
            }
            value={annualizedReturn !== null ? <Percent value={annualizedReturn} /> : "—"}
          />
          <Stat
            label="TWR"
            title="Time-weighted annualised return: how the strategy did with deposit timing removed — the one to compare against an index."
            value={twrAnnualized !== null ? <Percent value={twrAnnualized} /> : "—"}
          />
          <Stat
            label="Volatility"
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
            title="What the concentration figures are shares of. Holdings only — cash is excluded."
            // Neutral: a value held is not a gain. Only the return and risk
            // figures in this row carry a colour.
            value={`${sgd}${formatAmount(holdingsValueSgd)}`}
          />
        </dl>
        <p className="text-xs text-ink-500">
          {snapshots.length} daily snapshots
          {snapshots.length > 0 &&
            ` · ${formatShortDate(new Date(snapshots[0].date))} – ${formatShortDate(
              new Date(snapshots[snapshots.length - 1].date)
            )}`}
        </p>
      </div>

      {/* Seven slides, one subject each (see PerformanceViews). This used to be
          three slides holding seven panels — a value chart and a drawdown curve
          and an index comparison stacked in one, then a concentration panel
          beside a risk-adjusted panel above a correlation matrix — so the
          figures you came for sat below the fold of a panel that is meant to be
          read in one look, and reading them meant scrolling inside a sub-tab.
          Splitting by subject is what removes the scroll rather than moving it;
          the seventh slide is the second half of the risk pair, which needed
          63px more than a 1024×600 panel-body had (see RiskPanel).

          Everything below is computed on the server and handed over as props:
          this page's arithmetic is unchanged, only its arrangement.

          The risk props are assembled here rather than in the client component
          for the same reason they always were — lib/risk.ts is the ONE
          implementation of each definition, and the app's risk-free assumption
          is a server-side constant. */}
      <PerformanceViews
        data={snapshots}
        benchmarks={BENCHMARKS}
        benchmarkSeries={benchmarkSeries}
        risk={
          concentrationStats && snapshots.length >= 2
            ? ({
                concentration: concentrationStats,
                slices: riskSlices.slice(0, 8),
                hiddenCount: Math.max(0, riskSlices.length - 8),
                volatility,
                sharpe,
                annualReturn: twrAnnualized,
                riskFreeRate: RISK_FREE_RATE,
                largestMove: biggestDay,
                rolling: rollingPoints,
                rollingWindowDays: 365,
                windowLabel: `${formatShortDate(new Date(snapshots[0].date))} – ${formatShortDate(
                  new Date(snapshots[snapshots.length - 1].date)
                )}`,
                days: snapshots.length,
                totalSgd: holdingsValueSgd,
              } satisfies Omit<RiskPanelProps, "panel">)
            : null
        }
        years={yearReturns}
      />
    </div>
  );
}

/**
 * One figure in the statistics row.
 *
 * The `title` is not decoration: every number here is an estimate with a
 * definition, and a reader who wants to know which definition gets it on
 * hover rather than in a footnote they will not scroll to. That is also the
 * reason the glossary paragraph that used to sit above this row could go — the
 * definitions were already here, one hover away from the figure itself.
 *
 * A `dt`/`dd` pair inside the page bar's `<dl class="stat-strip">`, so the
 * label and the figure are associated for a screen reader instead of being two
 * paragraphs that happen to sit together.
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
    <div className="flex items-baseline gap-2" title={title}>
      <dt>{label}</dt>
      <dd
        className={
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : undefined
        }
      >
        {value}
      </dd>
    </div>
  );
}
