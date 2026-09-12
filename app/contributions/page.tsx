import { prisma } from "@/lib/prisma";
import { Money } from "@/components/SignedNumber";
import AddContributionForm from "@/components/AddContributionForm";
import PieChart from "@/components/PieChart";
import ContributionsPivotTable from "@/components/ContributionsPivotTable";
import { toLocalDateInputValue } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ContributionsPage() {
  const contributions = await prisma.contribution.findMany({
    include: { contributor: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const totalsByContributor = new Map<string, number>();
  let grandTotal = 0;
  let latestDate: Date | null = null;
  for (const c of contributions) {
    const name = c.contributor.name;
    totalsByContributor.set(name, (totalsByContributor.get(name) ?? 0) + c.amount);
    grandTotal += c.amount;
    if (!latestDate || c.date > latestDate) latestDate = c.date;
  }

  const contributorRows = Array.from(totalsByContributor.entries())
    .map(([name, total]) => ({
      name,
      total,
      pct: grandTotal === 0 ? 0 : total / grandTotal,
    }))
    .sort((a, b) => b.total - a.total);

  const knownContributors = contributorRows.map((r) => r.name);

  // Default label/date for the "add default month" quick action — one
  // calendar month after the most recent contribution on record.
  const base = latestDate ?? new Date();
  const nextMonthDateObj = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const nextMonthLabel = `${nextMonthDateObj
    .toLocaleString("en-US", { month: "short" })
    .toUpperCase()} (${nextMonthDateObj.getFullYear()})`;
  const nextMonthDate = toLocalDateInputValue(nextMonthDateObj);

  // Pivot the flat contribution rows into one row per label (usually a
  // month, e.g. "MAR (2025)") with one column per stakeholder — this is
  // how the sheet showed it, since contributions land in bulk per month
  // rather than as separate ledger-style entries. Most recent month first.
  // Each cell keeps the underlying contribution's id (when there's
  // exactly one) so the pivot table can offer inline edit/delete;
  // duplicate contributions under the same label+contributor (rare) fall
  // back to a read-only summed cell rather than picking one arbitrarily.
  const labelGroups = new Map<
    string,
    { date: Date; entries: Map<string, { id: number; amount: number }[]> }
  >();
  for (const c of contributions) {
    const existing = labelGroups.get(c.label);
    const group = existing ?? { date: c.date, entries: new Map() };
    const list = group.entries.get(c.contributor.name) ?? [];
    list.push({ id: c.id, amount: c.amount });
    group.entries.set(c.contributor.name, list);
    if (c.date < group.date) group.date = c.date;
    labelGroups.set(c.label, group);
  }
  const labelRows = Array.from(labelGroups.entries())
    .map(([label, g]) => {
      const cells = contributorRows.map((r) => {
        const list = g.entries.get(r.name) ?? [];
        if (list.length === 0) return { name: r.name, id: null, amount: null, multiple: false };
        if (list.length === 1) return { name: r.name, id: list[0].id, amount: list[0].amount, multiple: false };
        return {
          name: r.name,
          id: null,
          amount: list.reduce((sum, e) => sum + e.amount, 0),
          multiple: true,
        };
      });
      const rowTotal = cells.reduce((sum, c) => sum + (c.amount ?? 0), 0);
      return { label, dateMs: g.date.getTime(), cells, rowTotal };
    })
    .sort((a, b) => b.dateMs - a.dateMs);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-ink-300">Total portfolio contributions</p>
        <p className="num mt-1 text-4xl font-medium">
          <Money value={grandTotal} />
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-medium text-ink-300">By stakeholder</h2>
        {contributorRows.length === 0 ? (
          <p className="text-sm text-ink-300">No contributions recorded yet.</p>
        ) : (
          <PieChart
            slices={contributorRows.map((r) => ({ label: r.name, value: r.total }))}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-300">Contribution history</h2>
          <AddContributionForm
            knownContributors={knownContributors}
            nextMonthLabel={nextMonthLabel}
            nextMonthDate={nextMonthDate}
          />
        </div>
        <ContributionsPivotTable
          contributorNames={contributorRows.map((r) => r.name)}
          contributorTotals={Object.fromEntries(contributorRows.map((r) => [r.name, r.total]))}
          labelRows={labelRows}
          grandTotal={grandTotal}
        />
      </section>
    </div>
  );
}
