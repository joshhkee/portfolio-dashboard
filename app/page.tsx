import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { NativeMoney, Percent } from "@/components/SignedNumber";
import { currencySymbol } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import PieChart from "@/components/PieChart";
import RegionFlag from "@/components/RegionFlag";

export const dynamic = "force-dynamic";

const sgd = currencySymbol.SGD;

interface ActivityItem {
  dateMs: number;
  description: string;
  amount: string;
}

export default async function HomePage() {
  const [contributions, transactions, exchanges] = await Promise.all([
    prisma.contribution.findMany({ include: { contributor: true }, orderBy: { date: "desc" } }),
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 10 }),
    prisma.cashExchange.findMany({ orderBy: { date: "desc" }, take: 5 }),
  ]);

  let totalInvested = 0;
  let earliestMs: number | null = null;
  const totalsByContributor = new Map<string, number>();
  for (const c of contributions) {
    totalInvested += c.amount;
    totalsByContributor.set(
      c.contributor.name,
      (totalsByContributor.get(c.contributor.name) ?? 0) + c.amount
    );
    const ms = c.date.getTime();
    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
  }
  const contributorSlices = Array.from(totalsByContributor.entries())
    .map(([name, total]) => ({ label: name, value: total }))
    .sort((a, b) => b.value - a.value);

  // Standard currency for the dashboard is SGD (Josh is SG-based) — one
  // fetch across all three regions, converted to SGD; the per-region
  // breakdown below groups this same result rather than fetching (and
  // re-pricing) each region separately.
  const allPositions = await getOpenPositionsFor(["US", "SG", "HK"], "SGD");
  const currentValue = allPositions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const totalUnrealizedPL = allPositions.reduce((sum, p) => sum + p.unrealizedPLConverted, 0);
  const growth = totalInvested > 0 ? (currentValue - totalInvested) / totalInvested : 0;

  // Approximate annualized return — treats the whole invested total as
  // a single lump sum put in at the earliest contribution date, not
  // weighted by when each individual contribution actually landed (a
  // true money-weighted/XIRR return would need that). Same spirit as
  // the FX-uses-current-not-historical-rate approximation elsewhere:
  // a known simplification, not a bug.
  const daysSinceInception = earliestMs ? Math.max(1, (Date.now() - earliestMs) / 86400000) : null;
  const annualizedReturn =
    daysSinceInception && totalInvested > 0 && currentValue > 0
      ? Math.pow(currentValue / totalInvested, 365.25 / daysSinceInception) - 1
      : null;

  const regionBreakdown = ["US", "SG", "HK"].map((region) => ({
    region,
    value: allPositions
      .filter((p) => p.region === region)
      .reduce((sum, p) => sum + p.totalHoldingsConverted, 0),
  }));

  // Recent activity: transactions, outlay, and exchanges merged into
  // one feed, newest first.
  const activity: ActivityItem[] = [];
  for (const t of transactions) {
    activity.push({
      dateMs: t.date.getTime(),
      description: `${t.action} ${t.ticker} (${t.region})`,
      amount: `${t.qty} @ ${currencySymbol[t.region === "US" ? "USD" : t.region === "SG" ? "SGD" : "HKD"]}${t.price.toFixed(2)}`,
    });
  }
  for (const c of contributions.slice(0, 10)) {
    activity.push({
      dateMs: c.date.getTime(),
      description: `Outlay — ${c.contributor.name} (${c.label})`,
      amount: `${sgd}${c.amount.toFixed(2)}`,
    });
  }
  for (const ex of exchanges) {
    activity.push({
      dateMs: ex.date.getTime(),
      description: `Exchange ${ex.fromCurrency} → ${ex.toCurrency}`,
      amount: `${currencySymbol[ex.fromCurrency as "SGD" | "USD" | "HKD"]}${ex.fromAmount.toFixed(2)} → ${currencySymbol[ex.toCurrency as "SGD" | "USD" | "HKD"]}${ex.toAmount.toFixed(2)}`,
    });
  }
  activity.sort((a, b) => b.dateMs - a.dateMs);
  const recentActivity = activity.slice(0, 10);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <div>
          <p className="text-sm text-ink-300">Total invested</p>
          <p className="num mt-1 text-2xl font-medium">
            <NativeMoney value={totalInvested} symbol={sgd} />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Portfolio value (SGD)</p>
          <p className="num mt-1 text-2xl font-medium">
            <NativeMoney value={currentValue} symbol={sgd} />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Unrealized P/L (SGD)</p>
          <p className="num mt-1 text-2xl font-medium">
            <NativeMoney value={totalUnrealizedPL} symbol={sgd} showPlus />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Growth since inception</p>
          <p className="num mt-1 text-2xl font-medium">
            <Percent value={growth} />
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm text-ink-300">Annualized return</p>
        <p className="num mt-1 text-xl font-medium">
          {annualizedReturn !== null ? <Percent value={annualizedReturn} /> : "—"}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Approximate — treats total outlay as a single lump sum from the earliest contribution
          date, not weighted by when each contribution actually landed.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-300">Portfolio value by region (SGD)</h2>
        <div className="flex flex-wrap gap-10">
          {regionBreakdown.map((r) => (
            <div key={r.region}>
              <p className="flex items-center gap-1.5 text-sm text-ink-300">
                <RegionFlag region={r.region} />
                {r.region}
              </p>
              <p className="num mt-1 text-xl font-medium">
                <NativeMoney value={r.value} symbol={sgd} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium text-ink-300">Outlay by stakeholder</h2>
        {contributorSlices.length === 0 ? (
          <p className="text-sm text-ink-300">No outlay recorded yet.</p>
        ) : (
          <PieChart slices={contributorSlices} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-300">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-ink-300">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-700">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="w-16 shrink-0 text-ink-500">{formatShortDate(new Date(item.dateMs))}</span>
                <span className="flex-1 text-ink-100">{item.description}</span>
                <span className="num text-ink-300">{item.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
