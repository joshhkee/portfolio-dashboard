import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { fetchFxRates, convertCurrency } from "@/lib/fx";
import { NativeMoney } from "@/components/SignedNumber";
import CompletedTradesTable from "@/components/CompletedTradesTable";

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
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-ink-300">Total realized P/L (SGD)</p>
        <p className="num mt-1 text-3xl font-medium">
          <NativeMoney value={totalRealizedSGD} symbol="S$" />
        </p>
        <p className="mt-1 text-xs text-ink-300">
          US and HK trades are converted at the current SGD/USD and SGD/HKD rate — not the
          rate on the actual sell date, so this is an approximation for older trades.
        </p>
      </div>

      <CompletedTradesTable trades={tradesWithSGD} />
    </div>
  );
}
