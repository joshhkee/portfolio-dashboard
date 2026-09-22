import Link from "next/link";
import { Wallet, LineChart, CheckCircle2, PiggyBank, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { NativeMoney, Percent, formatAmount } from "@/components/SignedNumber";
import { currencySymbol, convertCurrency, fetchFxRates, type Currency } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import { xirr } from "@/lib/xirr";
import RegionFlag from "@/components/RegionFlag";
import { recordTodaySnapshot, getSnapshots, maxDrawdown } from "@/lib/snapshots";
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

interface ActivityItem {
  dateMs: number;
  description: string;
  amount: string;
}

export default async function HomePage() {
  // Opportunistically record today's snapshot (idempotent, one row per
  // UTC day, fails soft). Done before the parallel reads so the chart
  // includes today even on the first load of the day.
  await recordTodaySnapshot();

  const [contributions, cashRows, rates, allPositions, recentTransactions, allTransactions, exchanges, snapshots] =
    await Promise.all([
      prisma.contribution.findMany({ include: { contributor: true }, orderBy: { date: "desc" } }),
      prisma.cashBalance.findMany(),
      // fetchFxRates is called inside getOpenPositionsFor too, but
      // Next.js's fetch cache dedupes identical requests within one
      // render, so this isn't a second network round trip in practice.
      fetchFxRates(),
      getOpenPositionsFor(["US", "SG", "HK"], "SGD"),
      prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 10 }),
      prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] }),
      prisma.cashExchange.findMany({ orderBy: { date: "desc" }, take: 3 }),
      getSnapshots(),
    ]);

  // Benchmark indices for the comparison chart. getBenchmarkCloses() caches
  // for 15 minutes and single-flights, so this costs three Yahoo requests per
  // quarter hour rather than three per page load — and the point of the
  // cache is that the number of calls is bounded by the NUMBER OF INDICES,
  // never by the number of positions or days. Skipped entirely until there
  // are two snapshots to compare.
  const benchmarkCloses =
    snapshots.length >= 2
      ? await Promise.all(BENCHMARKS.map((b) => getBenchmarkCloses(b.symbol)))
      : [];
  const snapshotDates = snapshots.map((s) => s.date);
  const benchmarkSeries: Record<string, (number | null)[]> = {};
  for (let i = 0; i < BENCHMARKS.length; i++) {
    // Aligned 1:1 with `snapshots` so the client can slice both by the same
    // offset when the range changes (see PortfolioPerformance).
    benchmarkSeries[BENCHMARKS[i].key] = alignCloses(snapshotDates, benchmarkCloses[i] ?? {});
  }

  // --- Outlay totals + stakeholder breakdown ---
  let totalOutlay = 0;
  const totalsByContributor = new Map<string, number>();
  for (const c of contributions) {
    totalOutlay += c.amount;
    totalsByContributor.set(
      c.contributor.name,
      (totalsByContributor.get(c.contributor.name) ?? 0) + c.amount
    );
  }
  const contributorSlices = Array.from(totalsByContributor.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // --- Cash (SGD-converted) ---
  let cashTotalSgd = 0;
  for (const row of cashRows) {
    cashTotalSgd += convertCurrency(row.balance, CURRENCY_TO_REGION[row.currency], "SGD", rates);
  }

  // --- Holdings (positions only, SGD) + regional breakdown ---
  const holdingsValueSgd = allPositions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const holdingsUnrealizedPL = allPositions.reduce((sum, p) => sum + p.unrealizedPLConverted, 0);
  const regionSlices = ["US", "SG", "HK"].map((region) => ({
    label: region,
    value: allPositions
      .filter((p) => p.region === region)
      .reduce((sum, p) => sum + p.totalHoldingsConverted, 0),
    icon: <RegionFlag region={region} />,
  }));

  // --- Hero: total portfolio value inclusive of cash ---
  const totalPortfolioValue = holdingsValueSgd + cashTotalSgd;
  const growth = totalOutlay > 0 ? (totalPortfolioValue - totalOutlay) / totalOutlay : 0;
  const growthAbsolute = totalPortfolioValue - totalOutlay;

  // Money-weighted annualized return (XIRR): each contribution as money
  // in, today's total portfolio value (incl. cash) as the final "cash
  // out" — accounts for WHEN each contribution landed, unlike a
  // lump-sum CAGR from a single inception date.
  const cashflows: { amount: number; date: Date }[] = [];
  for (let i = contributions.length - 1; i >= 0; i--) {
    cashflows.push({ amount: -contributions[i].amount, date: contributions[i].date });
  }
  if (cashflows.length > 0) cashflows.push({ amount: totalPortfolioValue, date: new Date() });
  const annualizedReturn = xirr(cashflows);

  const maxDrawdownPct = maxDrawdown(snapshots);

  // Time-weighted return, the counterpart to XIRR above. XIRR is money-weighted:
  // it answers "what did my dollars earn", so it's moved by WHEN contributions
  // landed. TWR strips contribution timing out entirely and answers "how did
  // the strategy do" — the number to compare against a benchmark. With monthly
  // deposits across five stakeholders, the two can differ noticeably, which is
  // exactly why both are shown.
  const twrTotal = timeWeightedReturn(snapshots);
  const twrAnnualized =
    twrTotal !== null && snapshots.length >= 2
      ? annualizeReturn(twrTotal, snapshots[0].date, snapshots[snapshots.length - 1].date)
      : null;
  const yearReturns = yearlyReturns(snapshots);

  // --- Risk & concentration ---
  // Computed over ALL history rather than the chart range picker above:
  // volatility and the Sharpe ratio are estimates, and a one-month window
  // makes them swing wildly without meaning anything. The rolling line inside
  // the panel is what shows how the statistic has moved over time.
  //
  // Concentration counts positions only, never cash — cash genuinely lowers
  // the risk of the portfolio, but it is not a position, and folding it in
  // would flatter every concentration number.
  const riskSlices = allPositions.map((p) => ({
    key: priceKey(p.region, p.ticker),
    ticker: p.ticker,
    name: p.name,
    value: p.totalHoldingsConverted,
    weight: p.portfolioPct,
  }));
  const concentrationStats = concentration(riskSlices.map((s) => s.value));
  const dailyReturns = portfolioDailyReturns(snapshots);
  const volatility = annualizedVolatility(dailyReturns);
  const sharpe = sharpeRatio(twrAnnualized, volatility);
  // Returns are between consecutive snapshots, so they align with snapshots
  // from the second one onwards.
  const biggestDay = largestMove(
    dailyReturns,
    snapshots.slice(1).map((s) => s.date)
  );
  // Drop the leading nulls (no full year behind them yet) so the line starts
  // on the first day the window is actually complete.
  const rollingPoints = rollingAnnualizedReturn(snapshots).flatMap((value, i) =>
    value === null ? [] : [{ date: snapshots[i].date, value }]
  );

  // --- Completed trades, last 6 months (SGD) ---
  const { completedTrades } = computeLedger(fromDbRows(allTransactions));
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  let completedTradesPLSgd = 0;
  let completedTradesCount = 0;
  for (const t of completedTrades) {
    if (t.sellDate >= sixMonthsAgo) {
      completedTradesPLSgd += convertCurrency(t.realizedPL, t.region, "SGD", rates);
      completedTradesCount++;
    }
  }

  // --- Recent activity: transactions itemized, outlay aggregated by month ---
  const activity: ActivityItem[] = [];
  for (const t of recentTransactions) {
    const currency = t.region === "US" ? "USD" : t.region === "SG" ? "SGD" : "HKD";
    activity.push({
      dateMs: t.date.getTime(),
      description: `${t.action} ${t.ticker} (${t.region})`,
      amount: `${t.qty} @ ${currencySymbol[currency as Currency]}${t.price.toFixed(2)}`,
    });
  }
  const outlayByMonth = new Map<string, { dateMs: number; total: number }>();
  for (const c of contributions) {
    const key = `${c.date.getFullYear()}-${c.date.getMonth()}`;
    const existing = outlayByMonth.get(key);
    if (existing) {
      existing.total += c.amount;
      if (c.date.getTime() < existing.dateMs) existing.dateMs = c.date.getTime();
    } else {
      outlayByMonth.set(key, { dateMs: c.date.getTime(), total: c.amount });
    }
  }
  for (const { dateMs, total } of outlayByMonth.values()) {
    activity.push({
      dateMs,
      description: `Outlay`,
      amount: `${sgd}${total.toFixed(2)}`,
    });
  }
  for (const ex of exchanges) {
    activity.push({
      dateMs: ex.date.getTime(),
      description: `Exchange ${ex.fromCurrency} \u2192 ${ex.toCurrency}`,
      amount: `${currencySymbol[ex.fromCurrency as Currency]}${ex.fromAmount.toFixed(2)} \u2192 ${currencySymbol[ex.toCurrency as Currency]}${ex.toAmount.toFixed(2)}`,
    });
  }
  activity.sort((a, b) => b.dateMs - a.dateMs);
  const recentActivity = activity.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: title + quick links */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-300">Overview</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/transactions?add=1" className="btn-primary flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.5} />
            Log a transaction
          </Link>
          <Link href="/outlay?add=1" className="btn-ghost flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.5} />
            Record a deposit
          </Link>
        </div>
      </div>

      {/* Hero + Total Holding Value, side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <p className="text-sm text-ink-300">Total Portfolio Value (SGD, incl. cash)</p>
          <p className="num mt-1 text-4xl font-medium text-ink-100">
            <NativeMoney value={totalPortfolioValue} symbol={sgd} />
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-1">
            <div>
              <span className="text-xs text-ink-300">Growth vs outlay </span>
              <span className="num text-sm">
                <NativeMoney value={growthAbsolute} symbol={sgd} showPlus />
              </span>{" "}
              <span className="num text-sm">
                (<Percent value={growth} />)
              </span>
            </div>
            <div>
              <span className="text-xs text-ink-300">Annualized return (XIRR) </span>
              <span className="num text-sm">
                {annualizedReturn !== null ? <Percent value={annualizedReturn} /> : "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-ink-300">Annualized return (TWR) </span>
              <span
                className="num text-sm"
                title="Time-weighted: contribution timing removed, so this reflects the strategy rather than the deposit schedule."
              >
                {twrAnnualized !== null ? <Percent value={twrAnnualized} /> : "—"}
              </span>
            </div>
            {maxDrawdownPct !== null && (
              <div>
                <span className="text-xs text-ink-300">Max drawdown </span>
                <span className="num text-sm text-loss">{(maxDrawdownPct * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-sm text-ink-300">Total Holding Value (SGD, excl. cash)</p>
            <p className="num text-lg font-medium text-ink-100">
              <NativeMoney value={holdingsValueSgd} symbol={sgd} />
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {regionSlices.map((s) => {
              const pct = holdingsValueSgd === 0 ? 0 : (s.value / holdingsValueSgd) * 100;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="flex w-11 shrink-0 items-center gap-1.5 text-sm text-ink-100">
                    {s.icon}
                    {s.label}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                    {/* Gold by the owner's explicit choice — see the note on
                        the `data` palette decision in docs/PLAN.md before
                        "correcting" this back to a data colour. */}
                    <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="num shrink-0 text-sm text-ink-100">
                    {sgd}
                    {formatAmount(s.value)}
                  </span>
                  <span className="num w-11 shrink-0 text-right text-xs text-ink-500">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Portfolio value over time, underwater curve and benchmark
          comparison, all driven by one range picker */}
      <PortfolioPerformance
        data={snapshots}
        benchmarks={BENCHMARKS}
        benchmarkSeries={benchmarkSeries}
      />

      {/* Concentration, risk-adjusted return and the correlation matrix */}
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

      {/* Sub-page summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/holdings" className="panel flex flex-col gap-2 p-5 transition hover:border-ink-500">
          <div className="flex items-center gap-2 text-ink-300">
            <LineChart size={16} strokeWidth={1.75} />
            <span className="text-sm">Holdings</span>
          </div>
          <p className="num text-xl font-medium text-ink-100">
            <NativeMoney value={holdingsValueSgd} symbol={sgd} />
          </p>
          <p className="text-xs text-ink-300">
            {allPositions.length} position{allPositions.length === 1 ? "" : "s"} ·{" "}
            <NativeMoney value={holdingsUnrealizedPL} symbol={sgd} showPlus /> unrealized
          </p>
        </Link>

        <Link href="/holdings/cash" className="panel flex flex-col gap-2 p-5 transition hover:border-ink-500">
          <div className="flex items-center gap-2 text-ink-300">
            <Wallet size={16} strokeWidth={1.75} />
            <span className="text-sm">Cash</span>
          </div>
          <p className="num text-xl font-medium text-ink-100">
            <NativeMoney value={cashTotalSgd} symbol={sgd} />
          </p>
          <p className="text-xs text-ink-300">Across SGD, USD, HKD</p>
        </Link>

        <Link
          href="/completed-trades"
          className="panel flex flex-col gap-2 p-5 transition hover:border-ink-500"
        >
          <div className="flex items-center gap-2 text-ink-300">
            <CheckCircle2 size={16} strokeWidth={1.75} />
            <span className="text-sm">Completed Trades</span>
          </div>
          <p className="num text-xl font-medium text-ink-100">
            <NativeMoney value={completedTradesPLSgd} symbol={sgd} showPlus />
          </p>
          <p className="text-xs text-ink-300">{completedTradesCount} trades · last 6 months</p>
        </Link>

        <Link href="/outlay" className="panel flex flex-col gap-2 p-5 transition hover:border-ink-500">
          <div className="flex items-center gap-2 text-ink-300">
            <PiggyBank size={16} strokeWidth={1.75} />
            <span className="text-sm">Outlay</span>
          </div>
          <p className="num text-xl font-medium text-ink-100">
            <NativeMoney value={totalOutlay} symbol={sgd} />
          </p>
          <p className="text-xs text-ink-300">{contributorSlices.length} stakeholders</p>
        </Link>
      </div>

      {/* Factsheet-style per-year breakdown */}
      <YearlyReturnsTable years={yearReturns} />

      {/* Outlay by stakeholder + Recent activity, side by side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-300">Outlay by stakeholder</h2>
          {contributorSlices.length === 0 ? (
            <p className="text-sm text-ink-300">No outlay recorded yet.</p>
          ) : (
            <div className="panel divide-y divide-ink-700 px-4">
              {contributorSlices.map((s) => {
                const pct = totalOutlay === 0 ? 0 : (s.value / totalOutlay) * 100;
                return (
                  <div key={s.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-ink-100">{s.label}</span>
                    <span className="num text-ink-300">
                      {sgd}
                      {formatAmount(s.value)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-300">Recent activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-ink-300">Nothing recorded yet.</p>
          ) : (
            <div className="panel divide-y divide-ink-700 px-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-xs text-ink-500">
                      {formatShortDate(new Date(item.dateMs))}
                    </span>
                    <span className="truncate text-ink-100">{item.description}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-ink-300">{item.amount}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
