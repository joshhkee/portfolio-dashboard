import Link from "next/link";
import {
  Wallet,
  LineChart,
  CheckCircle2,
  PiggyBank,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { NativeMoney, Percent } from "@/components/SignedNumber";
import { currencySymbol, convertCurrency, fetchFxRates, type Currency } from "@/lib/fx";
import { formatShortDate, toLocalDateInputValue } from "@/lib/dates";
import { xirr } from "@/lib/xirr";
import AllocationBars from "@/components/AllocationBars";
import RegionFlag from "@/components/RegionFlag";
import AddTransactionForm from "@/components/AddTransactionForm";
import AddContributionForm from "@/components/AddContributionForm";

export const dynamic = "force-dynamic";

const sgd = currencySymbol.SGD;
const CURRENCY_TO_REGION: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };

interface ActivityItem {
  dateMs: number;
  description: string;
  amount: string;
}

export default async function HomePage() {
  const [contributions, cashRows, rates, allPositions, recentTransactions, allTransactions, exchanges] =
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
    ]);

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

  // --- Quick-add form data ---
  const knownContributors = contributorSlices.map((s) => s.label);
  let latestContribDate = new Date();
  if (contributions.length > 0) {
    latestContribDate = contributions[0].date;
    for (const c of contributions) {
      if (c.date > latestContribDate) latestContribDate = c.date;
    }
  }
  const nextMonthDateObj = new Date(latestContribDate.getFullYear(), latestContribDate.getMonth() + 1, 1);
  const nextMonthLabel = `${nextMonthDateObj
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase()} (${nextMonthDateObj.getFullYear()})`;
  const nextMonthDate = toLocalDateInputValue(nextMonthDateObj);

  return (
    <div className="flex flex-col gap-10">
      {/* Header row: title + collapsible quick actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-ink-300">Overview</p>
        <div className="flex flex-wrap gap-2">
          <AddTransactionForm />
          <AddContributionForm
            knownContributors={knownContributors}
            nextMonthLabel={nextMonthLabel}
            nextMonthDate={nextMonthDate}
          />
        </div>
      </div>

      {/* Hero: total portfolio value, inclusive of cash */}
      <div className="panel p-8">
        <p className="text-sm text-ink-300">Total Portfolio Value (SGD, incl. cash)</p>
        <p className="num mt-2 text-5xl font-medium text-ink-100">
          <NativeMoney value={totalPortfolioValue} symbol={sgd} />
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2">
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
            <span className="text-xs text-ink-300">Annualized return </span>
            <span className="num text-sm">
              {annualizedReturn !== null ? <Percent value={annualizedReturn} /> : "—"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Annualized return is money-weighted (XIRR) — accounts for when each contribution
          landed, not just a single lump sum from inception.
        </p>
      </div>

      {/* Total Holding Value + regional breakdown */}
      <div className="panel p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm text-ink-300">Total Holding Value (SGD, excl. cash)</p>
          <p className="num text-xl font-medium text-ink-100">
            <NativeMoney value={holdingsValueSgd} symbol={sgd} />
          </p>
        </div>
        <AllocationBars slices={regionSlices} symbol={sgd} />
      </div>

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

      {/* Outlay by stakeholder */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-ink-300">Outlay by stakeholder</h2>
        {contributorSlices.length === 0 ? (
          <p className="text-sm text-ink-300">No outlay recorded yet.</p>
        ) : (
          <AllocationBars slices={contributorSlices} symbol={sgd} />
        )}
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-300">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-ink-300">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-700">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="flex items-baseline gap-2">
                  <span className="text-ink-500">{formatShortDate(new Date(item.dateMs))}</span>
                  <span className="text-ink-100">{item.description}</span>
                </span>
                <span className="num text-ink-300">{item.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
