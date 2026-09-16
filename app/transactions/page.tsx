import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionsTable from "@/components/TransactionsTable";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { ledger } = computeLedger(fromDbRows(raw));
  const negativeRows = ledger.filter((t) => t.runningQty < 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="label">Ledger</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-fg">Transactions</h1>
        </div>
        <AddTransactionForm />
      </header>

      {negativeRows.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-negative/30 bg-negative-wash px-4 py-3.5 text-sm text-fg-muted">
          <AlertTriangle
            size={15}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-negative"
            aria-hidden
          />
          <span>
            {negativeRows.length} position{negativeRows.length > 1 ? "s" : ""} went negative —
            more was sold than was ever bought for that ticker/region. Rows are highlighted below.
            This usually means a Sell is missing its matching Buy, or has the wrong ticker, region,
            qty, or date. Fix or delete the offending row(s) below.
          </span>
        </div>
      )}

      <TransactionsTable ledger={ledger} />
    </div>
  );
}
