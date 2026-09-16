import { prisma } from "@/lib/prisma";
import { PlainMoney } from "@/components/SignedNumber";
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
      // "Initial Investment" shares its literal date with MAR (2025) in
      // the historical data, but it conceptually happened first — nudge
      // its sort key one day earlier so it always sorts as the older of
      // the two (i.e. lands below MAR 2025 in this newest-first table).
      // One-off tie-break, not a general reordering rule.
      const dateMs =
        label === "Initial Investment" ? g.date.getTime() - 86400000 : g.date.getTime();
      return { label, dateMs, cells, rowTotal };
    })
    .sort((a, b) => b.dateMs - a.dateMs);

  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="label">Contributions</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-fg">Capital in</h1>
        </div>
        <div className="text-right">
          <p className="label">Total contributions</p>
          <p className="num mt-2 text-4xl font-medium tracking-tight text-accent">
            <PlainMoney value={grandTotal} />
          </p>
        </div>
      </header>

      <section>
        <h2 className="label">By stakeholder</h2>
        <div className="mt-6">
          {contributorRows.length === 0 ? (
            <p className="text-sm text-fg-muted">No contributions recorded yet.</p>
          ) : (
            <PieChart
              slices={contributorRows.map((r) => ({ label: r.name, value: r.total }))}
            />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="label">Contribution history</h2>
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
