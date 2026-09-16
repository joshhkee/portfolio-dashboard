import { prisma } from "@/lib/prisma";

/** Atomically adjusts a currency's cash balance by delta (positive to add,
 * negative to deduct), creating the row at 0 first if it doesn't exist yet.
 * Used to auto-track cash alongside contributions/outlay, buys, sells, and
 * exchanges — the balance itself stays directly editable (see schema.prisma
 * for why), this just keeps it moving in step with the ledger by default. */
export async function adjustCashBalance(currency: string, delta: number) {
  if (delta === 0) return;
  await prisma.cashBalance.upsert({
    where: { currency },
    update: { balance: { increment: delta } },
    create: { currency, balance: delta },
  });
}
