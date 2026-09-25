import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { ensureNamesFor, getNameMap } from "@/lib/ticker-meta";
import { TriangleAlert } from "lucide-react";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionsTable from "@/components/TransactionsTable";
import {
  TableSearch,
  TableSearchCount,
  TableSearchField,
} from "@/components/TableSearch";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { ledger } = computeLedger(fromDbRows(raw));
  const negativeRows = ledger.filter((t) => t.runningQty < 0);
  // Display names for every ticker in the ledger. The holdings path only
  // caches what's currently held, so this also fills in any closed position
  // that has never been seen — a bounded lookup per unseen ticker, then a
  // plain DB read on every later render.
  await ensureNamesFor(ledger.map((t) => ({ region: t.region, ticker: t.ticker })));
  const names = await getNameMap();

  return (
    <TableSearch>
      <div className="screen">
        {/* One bar instead of the two bands this page had.

            "Transaction ledger" over "64 entries" on one side and two buttons on
            the other used to be ~80px of a 900px window, with the table's own
            filter another band below it — so a page whose entire content is a
            list spent a fifth of the screen naming itself. Then the filter moved
            DOWN into the table's head to win that band back, which cost the table
            a row instead. It is now the middle of THIS row: the count on the
            left, the field centred between it and the two actions on the right,
            in the one band the page always had.

            The count is the shared one (`TableSearchCount`), because the number
            that matters while you are typing is how many rows the filter LEFT,
            not how many the ledger holds — the field is in the page bar but the
            filtering happens in the table, and a stale "64 entries" over twelve
            rows is worse than no count at all. */}
        <div className="page-bar lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-baseline gap-2">
            <h1 className="text-sm font-medium text-ink-100">Transaction ledger</h1>
            <TableSearchCount total={ledger.length} singular="entry" plural="entries" />
          </div>
          <TableSearchField placeholder="Search ticker, region, or notes…" />
          <div className="flex items-center gap-2 lg:justify-self-end">
            {/* API download — rule only wants page navigations in <Link>. */}
            <a
              href="/api/export/transactions"
              download
              className="btn-ghost-sm"
              title="Download the full ledger as CSV"
            >
              Export CSV
            </a>
            <AddTransactionForm />
          </div>
        </div>

        {/* Kept, shortened. It is not narration: it says a number on this page
            cannot be right and which rows are wrong, so it stays above the table
            at `shrink-0` — the one thing on this page allowed to cost the table
            height, because it is the only thing here that must not be missed. */}
        {negativeRows.length > 0 && (
          <div className="flex shrink-0 items-start gap-2 border border-loss/50 bg-loss/10 px-3 py-2 text-xs text-loss">
            <TriangleAlert size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>
              {negativeRows.length} position{negativeRows.length > 1 ? "s" : ""} went negative —
              more was sold than bought for that ticker/region, so a Sell is probably missing its
              Buy or has the wrong ticker, region, qty or date. The rows are highlighted below.
            </span>
          </div>
        )}

        <TransactionsTable ledger={ledger} names={names} />
      </div>
    </TableSearch>
  );
}
