import { prisma } from "@/lib/prisma";
import { fetchFxRates } from "@/lib/fx";
import CashPanel from "@/components/CashPanel";

export const dynamic = "force-dynamic";

const CURRENCIES = ["SGD", "USD", "HKD"] as const;

export default async function CashPage() {
  const [rows, rates, recentExchanges] = await Promise.all([
    prisma.cashBalance.findMany(),
    fetchFxRates(),
    prisma.cashExchange.findMany({ orderBy: { date: "desc" }, take: 8 }),
  ]);

  const balances = Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<string, number>;
  for (const row of rows) {
    balances[row.currency] = row.balance;
  }

  const exchangesForClient = [];
  for (const e of recentExchanges) {
    exchangesForClient.push({
      id: e.id,
      date: e.date.toISOString(),
      fromCurrency: e.fromCurrency,
      fromAmount: e.fromAmount,
      toCurrency: e.toCurrency,
      toAmount: e.toAmount,
      rate: e.rate,
      auto: e.auto,
    });
  }

  return (
    <CashPanel balances={balances} rates={rates} recentExchanges={exchangesForClient} />
  );
}
