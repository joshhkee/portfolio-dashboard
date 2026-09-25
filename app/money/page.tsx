import { prisma } from "@/lib/prisma";
import { PlainMoney } from "@/components/SignedNumber";
import AddContributionForm from "@/components/AddContributionForm";
import AllocationCards from "@/components/AllocationCards";
import ContributionsPivotTable from "@/components/ContributionsPivotTable";
import SlideDeck from "@/components/SlideDeck";
import StakeholderPerformance from "@/components/StakeholderPerformance";
import { toLocalDateInputValue } from "@/lib/dates";
import { depositSchedule } from "@/lib/schedule";
import { getOpenPositionsFor } from "@/lib/get-positions";
import { convertCurrency, fetchFxRates } from "@/lib/fx";
import { getSnapshots } from "@/lib/snapshots";
import { splitByStakeholder, stakeholderTimeline } from "@/lib/stakeholders";

export const dynamic = "force-dynamic";

const CURRENCY_TO_REGION: Record<string, string> = { SGD: "SG", USD: "US", HKD: "HK" };

export default async function ContributionsPage() {
  const contributions = await prisma.contribution.findMany({
    include: { contributor: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  // Current portfolio value (holdings + cash, in SGD) — deliberately the SAME
  // computation the overview page uses, because the per-stakeholder slices
  // below must reconcile with the headline total, and the only way to
  // guarantee that is to derive them from the identical number.
  const [positions, cashRows, rates, snapshots] = await Promise.all([
    getOpenPositionsFor(["US", "SG", "HK"], "SGD"),
    prisma.cashBalance.findMany(),
    fetchFxRates(),
    getSnapshots(),
  ]);

  let cashTotalSgd = 0;
  for (const row of cashRows) {
    cashTotalSgd += convertCurrency(row.balance, CURRENCY_TO_REGION[row.currency], "SGD", rates);
  }
  const holdingsValueSgd = positions.reduce((sum, p) => sum + p.totalHoldingsConverted, 0);
  const totalPortfolioValueSgd = holdingsValueSgd + cashTotalSgd;

  const contributionInputs = contributions.map((c) => ({
    name: c.contributor.name,
    amount: c.amount,
    date: c.date,
  }));
  const stakeholderRows = splitByStakeholder(contributionInputs, totalPortfolioValueSgd);
  const stakeholderSeries = stakeholderTimeline(contributionInputs, snapshots);

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

  // Deposit timing, keyed by the same label the pivot groups on. A month's
  // money arrives as one lump split across stakeholders, so the month counts
  // as arrived when its last row did — see lib/schedule.ts. The arrival date
  // is still recorded and still editable per month; what the page no longer
  // does is SUM UP how many months landed late. The owner's model puts idle
  // cash to work rather than holding it, deposits are occasionally late by
  // plan, and nothing in the account earns interest — so a lateness score was
  // reporting a cost that does not exist. The quiet clock badge on the month
  // itself is all that remains.
  const schedule = depositSchedule(
    contributions.map((c) => ({ label: c.label, date: c.date, paidOn: c.paidOn }))
  );
  const timingByLabel = new Map(schedule.rows.map((r) => [r.label, r]));

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
      const timing = timingByLabel.get(label) ?? null;
      return {
        label,
        dateMs,
        cells,
        rowTotal,
        paidOn: timing?.paidOn ?? null,
        daysLate: timing?.daysLate ?? 0,
        // Every row under this label, so the label cell's date edit can apply
        // to the whole month's lump in one go.
        contributionIds: Array.from(g.entries.values()).flat().map((e) => e.id),
      };
    })
    .sort((a, b) => b.dateMs - a.dateMs);

  return (
    <div className="screen">
      {/* One bar: the number, the export and the one action. The total used to
          be a `text-4xl` headline in a band of its own (~110px) with the two
          cards, a chart, a table and a pivot stacked under it to a depth of
          about 1800px — a page you scrolled four times to answer one question.
          The figure is smaller here because it is no longer the only thing on
          the screen: it is the label of the panel below it. */}
      <div className="page-bar">
        <dl className="stat-strip">
          <div className="flex items-baseline gap-2">
            <dt>Total outlay</dt>
            {/* Every contribution in this ledger is SGD, so the symbol is S$ —
                `Money` would print a bare "$" here and read as USD beside the
                S$-labelled cards in the panel below. Neutral, because money
                paid in is not a gain. */}
            <dd className="text-2xl">
              <PlainMoney value={grandTotal} symbol="S$" />
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-2">
          {/* API download — rule only wants page navigations in <Link>. */}
          <a
            href="/api/export/contributions"
            download
            className="btn-ghost-sm"
            title="Download all contributions as CSV"
          >
            Export CSV
          </a>
          <AddContributionForm
            knownContributors={knownContributors}
            nextMonthLabel={nextMonthLabel}
            nextMonthDate={nextMonthDate}
          />
        </div>
      </div>

      {/* Two views of the same outlay in one slot: who paid — with the months
          their money arrived in, underneath — and what each person's money has
          done. They were three stacked sections with three headings, which is
          what made this the longest page in the app.

          The outlay history is no longer a view of its own. It was a tab whose
          content is the DETAIL of the tab beside it: "who paid" is the cards,
          and "which month did it arrive in" is the same question one level
          down, so a reader looking at the split was one click away from the
          evidence for it. Side by side vertically they answer together, and the
          page loses a tab that had to be discovered. */}
      <SlideDeck
        ariaLabel="Money view"
        slides={[
          {
            label: "By stakeholder",
            hint: `${contributorRows.length} ${contributorRows.length === 1 ? "person" : "people"} · share of outlay, and every month it arrived in`,
            // Cards are a fixed cost; the pivot table takes the rest of the
            // panel and scrolls its own rows (`.table-scroll`), so the cards
            // never move and the panel itself never scrolls.
            content: (
              <div className="flex h-full min-h-0 flex-col gap-4 p-4">
                {contributorRows.length === 0 ? (
                  <p className="text-sm text-ink-300">No outlay recorded yet.</p>
                ) : (
                  <div className="shrink-0">
                    <AllocationCards
                      slices={contributorRows.map((r) => ({ label: r.name, value: r.total }))}
                      symbol="S$"
                    />
                  </div>
                )}
                <ContributionsPivotTable
                  contributorNames={contributorRows.map((r) => r.name)}
                  contributorTotals={Object.fromEntries(contributorRows.map((r) => [r.name, r.total]))}
                  labelRows={labelRows}
                  grandTotal={grandTotal}
                />
              </div>
            ),
          },
          {
            // Not "Performance": that is the name of a SECTION of this site —
            // returns, risk, attribution, realized trades — and a tab here
            // called "Performance" reading "each person's share of the
            // portfolio" is the same word meaning a narrower thing. This one
            // names its own subject instead: what each person's money has done.
            label: "Returns by person",
            hint: "Each person's value against what they paid in",
            content: (
              <div className="flex h-full min-h-0 flex-col p-4">
                <StakeholderPerformance rows={stakeholderRows} timeline={stakeholderSeries} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
