import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const { amount } = body;
  if (amount === undefined || Number(amount) <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const existing = await prisma.contribution.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }

  const contribution = await prisma.contribution.update({
    where: { id },
    data: { amount: Number(amount) },
  });

  return NextResponse.json(contribution);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await prisma.contribution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
