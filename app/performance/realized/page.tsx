import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { fetchFxRates, convertCurrency } from "@/lib/fx";
import { NativeMoney } from "@/components/SignedNumber";
import CompletedTradesTable from "@/components/CompletedTradesTable";
import {
  TableSearch,
  TableSearchCount,
  TableSearchField,
} from "@/components/TableSearch";
import { ensureNamesFor, getNameMap } from "@/lib/ticker-meta";

export const dynamic = "force-dynamic";

export default async function CompletedTradesPage() {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { completedTrades } = computeLedger(fromDbRows(raw));
  const rates = await fetchFxRates();

  // Names for tickers that were sold and so never appear in the (open-only)
  // holdings path. One lookup per unseen ticker; cached thereafter.
  await ensureNamesFor(completedTrades.map((t) => ({ region: t.region, ticker: t.ticker })));
  const names = await getNameMap();

  const tradesWithSGD = completedTrades.map((t) => ({
    ...t,
    realizedPLSGD: convertCurrency(t.realizedPL, t.region, "SGD", rates),
  }));

  const totalRealizedSGD = tradesWithSGD.reduce((sum, t) => sum + t.realizedPLSGD, 0);

  return (
    <TableSearch>
    <div className="screen">
      {/* The heading, the figure, the caveat and the export were three stacked
          bands (~160px) over a table. They are one bar now, and the caveat —
          which does change how the figure should be read — is on the figure's
          own label rather than in a paragraph below it.

          The filter is the middle of that bar rather than a row of its own above
          the table: this page shows a list and nothing else, so a band spent on
          a search field (and on the caption "Newest first", which said what the
          sort arrow already said) is a band taken from the rows. */}
      <div className="page-bar lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <dl className="stat-strip">
          <div className="flex items-baseline gap-2">
            <dt title="US and HK trades converted at today's SGD/USD and SGD/HKD rate, not the rate on the sell date — so this is an approximation for older trades.">
              Total realized P/L (SGD)
            </dt>
            <dd>
              <NativeMoney value={totalRealizedSGD} symbol="S$" showPlus />
            </dd>
          </div>
        </dl>
        <TableSearchCount total={tradesWithSGD.length} singular="trade" plural="trades" />
        </div>

        <TableSearchField placeholder="Search ticker, region, or notes…" />

        <div className="flex items-center gap-2 lg:justify-self-end">
          {/* API download, not a page navigation — <a download> is correct here. */}
          <a
            href="/api/export/completed-trades"
            download
            className="btn-ghost-sm"
            title="Download all completed trades as CSV"
          >
            Export CSV
          </a>
        </div>
      </div>

      <CompletedTradesTable trades={tradesWithSGD} names={names} />
    </div>
    </TableSearch>
  );
}
