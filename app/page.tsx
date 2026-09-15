import { prisma } from "@/lib/prisma";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { Money, NativeMoney, Percent } from "@/components/SignedNumber";
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
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <div>
          <p className="text-sm text-ink-300">Total invested</p>
          <p className="num mt-1 text-2xl font-medium">
            <Money value={totalInvested} />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Portfolio value (USD)</p>
          <p className="num mt-1 text-2xl font-medium">
            <Money value={currentValue} />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Unrealized P/L (USD)</p>
          <p className="num mt-1 text-2xl font-medium">
            <NativeMoney value={totalUnrealizedPL} symbol="$" showPlus />
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Growth since inception</p>
          <p className="num mt-1 text-2xl font-medium">
            <Percent value={growth} />
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-300">Portfolio value by region (USD)</h2>
        <div className="flex flex-wrap gap-10">
          {regionBreakdown.map((r) => (
            <div key={r.region}>
              <p className="text-sm text-ink-300">{r.region}</p>
              <p className="num mt-1 text-xl font-medium">
                <Money value={r.value} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium text-ink-300">Contributions by stakeholder</h2>
        {contributorSlices.length === 0 ? (
          <p className="text-sm text-ink-300">No contributions recorded yet.</p>
        ) : (
          <PieChart slices={contributorSlices} />
        )}
      </section>
    </div>
  );
}
