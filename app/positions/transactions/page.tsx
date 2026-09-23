import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { ensureNamesFor, getNameMap } from "@/lib/ticker-meta";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionsTable from "@/components/TransactionsTable";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-300">Transaction ledger</p>
          <p className="mt-1 text-2xl font-medium">{ledger.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          {/* API download — rule only wants page navigations in <Link>. */}
          <a href="/api/export/transactions" download className="btn-ghost" title="Download the full ledger as CSV">
            Export CSV
          </a>
          <AddTransactionForm />
        </div>
      </div>

      {negativeRows.length > 0 && (
        <div className="border border-loss/50 bg-loss/10 p-4 text-sm text-loss">
          {negativeRows.length} position{negativeRows.length > 1 ? "s" : ""} went negative —
          more was sold than was ever bought for that ticker/region. Rows are highlighted below.
          This usually means a Sell is missing its matching Buy, or has the wrong ticker, region,
          qty, or date. Fix or delete the offending row(s) below.
        </div>
      )}

      <TransactionsTable ledger={ledger} names={names} />
    </div>
  );
}
