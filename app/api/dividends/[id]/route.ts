import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "A valid payment id is required" }, { status: 400 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const record = await tx.dividend.findUnique({ where: { id } });
    if (!record) return false;
    await tx.dividend.delete({ where: { id } });
    await tx.cashBalance.upsert({
      where: { currency: record.currency },
      update: { balance: { decrement: record.amount } },
      create: { currency: record.currency, balance: -record.amount },
    });
    return true;
  });

  return deleted
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Dividend payment not found" }, { status: 404 });
}
