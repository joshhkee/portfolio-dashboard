import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_CURRENCIES = ["SGD", "USD", "HKD"];

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { currency, balance } = body;

  if (!VALID_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "currency must be SGD, USD, or HKD" }, { status: 400 });
  }
  if (balance === undefined || Number.isNaN(Number(balance))) {
    return NextResponse.json({ error: "balance must be a number" }, { status: 400 });
  }

  // A direct overwrite, not an increment — this is the "correct it by
  // hand when it drifts from reality" path, distinct from the
  // auto-adjustments contributions/buys/sells/exchanges make.
  const updated = await prisma.cashBalance.upsert({
    where: { currency },
    update: { balance: Number(balance) },
    create: { currency, balance: Number(balance) },
  });

  return NextResponse.json(updated);
}
