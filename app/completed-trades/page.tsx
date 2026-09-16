import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { fetchFxRates, convertCurrency } from "@/lib/fx";
import { NativeMoney } from "@/components/SignedNumber";
import CompletedTradesTable from "@/components/CompletedTradesTable";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompletedTradesPage() {
  const raw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const { completedTrades } = computeLedger(fromDbRows(raw));
  const rates = await fetchFxRates();

  const tradesWithSGD = completedTrades.map((t) => ({
    ...t,
    realizedPLSGD: convertCurrency(t.realizedPL, t.region, "SGD", rates),
  }));

  const totalRealizedSGD = tradesWithSGD.reduce((sum, t) => sum + t.realizedPLSGD, 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="label">Closed positions</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-fg">Completed trades</h1>
        </div>
        <div className="text-right">
          <p className="label">Total realized P/L (SGD)</p>
          <p className="mt-2 text-4xl font-medium tracking-tight">
            <NativeMoney value={totalRealizedSGD} symbol="S$" />
          </p>
        </div>
      </header>

      <p className="flex items-start gap-2 text-xs text-fg-subtle">
        <Info size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
        US and HK trades are converted at the current SGD/USD and SGD/HKD rate — not the rate on the
        actual sell date, so this is an approximation for older trades.
      </p>

      <CompletedTradesTable trades={tradesWithSGD} />
    </div>
  );
}
