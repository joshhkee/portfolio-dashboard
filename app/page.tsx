import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { NativeMoney, Percent, PlainMoney } from "@/components/SignedNumber";
import PieChart from "@/components/PieChart";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const contributions = await prisma.contribution.findMany({ include: { contributor: true } });

  let totalInvested = 0;
  const totalsByContributor = new Map<string, number>();
  for (const c of contributions) {
    totalInvested += c.amount;
    totalsByContributor.set(
      c.contributor.name,
      (totalsByContributor.get(c.contributor.name) ?? 0) + c.amount
    );
  }
  const contributorSlices = Array.from(totalsByContributor.entries())
    .map(([name, total]) => ({ label: name, value: total }))
    .sort((a, b) => b.value - a.value);

  // One fetch across all three regions, converted to USD — the
  // per-region breakdown below groups this same result rather than
  // fetching (and re-pricing) each region separately.
  const allPositions = await getOpenPositionsFor(["US", "SG", "HK"], "USD");
  const currentValue = allPositions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const totalUnrealizedPL = allPositions.reduce((sum, p) => sum + p.unrealizedPLConverted, 0);
  const growth = totalInvested > 0 ? (currentValue - totalInvested) / totalInvested : 0;

  const regionBreakdown = ["US", "SG", "HK"].map((region) => ({
    region,
    value: allPositions
      .filter((p) => p.region === region)
      .reduce((sum, p) => sum + p.totalHoldingsConverted, 0),
  }));

  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="label">Portfolio</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-fg">Overview</h1>
          <p className="mt-2 max-w-md text-sm text-fg-muted">
            Contributions, live holdings and unrealized P/L across the US, SG and HK ledgers.
          </p>
        </div>
        <div className="text-right">
          <p className="label">Total invested</p>
          <p className="num mt-2 text-4xl font-medium tracking-tight text-accent">
            <PlainMoney value={totalInvested} />
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-5">
          <p className="label">Portfolio value (USD)</p>
          <p className="mt-2 text-2xl font-medium text-fg">
            <PlainMoney value={currentValue} />
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="label">Unrealized P/L (USD)</p>
          <p className="mt-2 text-2xl font-medium">
            <NativeMoney value={totalUnrealizedPL} symbol="$" showPlus />
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="label">Growth since inception</p>
          <p className="mt-2 text-2xl font-medium">
            <Percent value={growth} />
          </p>
        </div>
      </section>

      <section>
        <h2 className="label">Portfolio value by region (USD)</h2>
        <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {regionBreakdown.map((r) => (
            <div key={r.region} className="bg-surface px-6 py-5">
              <p className="label">{r.region}</p>
              <p className="num mt-2 text-xl text-fg">
                <PlainMoney value={r.value} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">Contributions by stakeholder</h2>
        <div className="mt-6">
          {contributorSlices.length === 0 ? (
            <p className="text-sm text-fg-muted">No contributions recorded yet.</p>
          ) : (
            <PieChart slices={contributorSlices} />
          )}
        </div>
      </section>

      <p className="border-t border-line pt-5 text-xs text-fg-subtle">
        Live quotes are pulled from Yahoo Finance and converted at the current FX rate — figures are
        indicative, not executed prices.
      </p>
    </div>
  );
}
