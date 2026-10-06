import { prisma } from "@/lib/prisma";
import ActivityTimeline from "@/components/ActivityTimeline";
import { buildActivityTimeline } from "@/lib/activity";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const [transactions, contributions, exchanges] = await Promise.all([
    prisma.transaction.findMany({
      select: { id: true, date: true, action: true, ticker: true, region: true, qty: true, price: true },
    }),
    prisma.contribution.findMany({
      select: {
        id: true,
        date: true,
        paidOn: true,
        label: true,
        amount: true,
        contributor: { select: { name: true } },
      },
    }),
    prisma.cashExchange.findMany({
      select: {
        id: true,
        date: true,
        fromCurrency: true,
        fromAmount: true,
        toCurrency: true,
        toAmount: true,
        rate: true,
        auto: true,
      },
    }),
  ]);

  const events = buildActivityTimeline({ transactions, contributions, exchanges });
  return <ActivityTimeline events={events} />;
}
