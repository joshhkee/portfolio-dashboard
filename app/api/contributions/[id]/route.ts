import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adjustCashBalance } from "@/lib/cash";
import { parseOptionalDateInput } from "@/lib/dates";

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
  const hasAmount = body.amount !== undefined;
  // `"paidOn" in body` rather than a truthiness check: an explicit null means
  // "the arrival date is unknown", which is different from not sending it.
  const hasPaidOn = "paidOn" in body;

  if (!hasAmount && !hasPaidOn) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (hasAmount && Number(body.amount) <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const paidOn = hasPaidOn ? parseOptionalDateInput(body.paidOn) : null;
  if (hasPaidOn && paidOn === undefined) {
    return NextResponse.json({ error: "paidOn must be a date or empty" }, { status: 400 });
  }

  const existing = await prisma.contribution.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }

  const contribution = await prisma.contribution.update({
    where: { id },
    data: {
      ...(hasAmount ? { amount: Number(body.amount) } : {}),
      ...(hasPaidOn ? { paidOn } : {}),
    },
  });

  // Cash already moved by the original amount when this was created — only
  // the difference needs to be applied now, and only when the amount moved.
  // A payment-date correction never touches cash: it changes WHEN the money
  // arrived, not how much.
  if (hasAmount) {
    await adjustCashBalance("SGD", Number(body.amount) - existing.amount);
  }

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
  const existing = await prisma.contribution.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
  }
  await prisma.contribution.delete({ where: { id } });
  await adjustCashBalance("SGD", -existing.amount);
  return NextResponse.json({ ok: true });
}
