import { prisma } from "@/lib/prisma";
import { Money, PlainMoney } from "@/components/SignedNumber";
import AddContributionForm from "@/components/AddContributionForm";
import PieChart from "@/components/PieChart";

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
  const nextMonthDate = nextMonthDateObj.toISOString().slice(0, 10);

  // Pivot the flat contribution rows into one row per label (usually a
  // month, e.g. "MAR (2025)") with one column per stakeholder — this is
  // how the sheet showed it, since contributions land in bulk per month
  // rather than as separate ledger-style entries. Most recent month first.
  const labelGroups = new Map<string, { date: Date; amounts: Map<string, number> }>();
  for (const c of contributions) {
    const existing = labelGroups.get(c.label);
    if (existing) {
      existing.amounts.set(
        c.contributor.name,
        (existing.amounts.get(c.contributor.name) ?? 0) + c.amount
      );
      if (c.date < existing.date) existing.date = c.date;
    } else {
      labelGroups.set(c.label, {
        date: c.date,
        amounts: new Map([[c.contributor.name, c.amount]]),
      });
    }
  }
  const labelRows = Array.from(labelGroups.entries())
    .map(([label, g]) => ({
      label,
      date: g.date,
      amounts: g.amounts,
      rowTotal: Array.from(g.amounts.values()).reduce((sum, v) => sum + v, 0),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

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
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Month / label</th>
                {contributorRows.map((r) => (
                  <th key={r.name}>{r.name}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {labelRows.map((row) => (
                <tr key={row.label}>
                  <td className="text-ink-300">{row.label}</td>
                  {contributorRows.map((r) => {
                    const amount = row.amounts.get(r.name);
                    return (
                      <td key={r.name}>
                        {amount ? <PlainMoney value={amount} /> : <span className="text-ink-500">—</span>}
                      </td>
                    );
                  })}
                  <td className="font-medium">
                    <PlainMoney value={row.rowTotal} />
                  </td>
                </tr>
              ))}
              {labelRows.length === 0 && (
                <tr>
                  <td colSpan={contributorRows.length + 2} className="py-6 text-center text-ink-300">
                    Nothing here yet — record the first deposit above.
                  </td>
                </tr>
              )}
            </tbody>
            {labelRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-ink-600 font-medium">
                  <td>Total</td>
                  {contributorRows.map((r) => (
                    <td key={r.name}>
                      <PlainMoney value={r.total} />
                    </td>
                  ))}
                  <td>
                    <PlainMoney value={grandTotal} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
