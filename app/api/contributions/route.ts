import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adjustCashBalance } from "@/lib/cash";
import { parseOptionalDateInput } from "@/lib/dates";

export async function GET() {
  const contributions = await prisma.contribution.findMany({
    include: { contributor: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(contributions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Bulk shape: { label, date, entries: [{ contributorName, amount }, ...] }
  // — used by the "add default month" quick action to record a whole
  // month's split (one row per stakeholder) in a single request.
  if (Array.isArray(body.entries)) {
    const { label, date, entries } = body;
    if (!label || !date || entries.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // `paidOn` is when the money arrived; `date` is the month it is attributed
    // to. Optional, and honestly null when unknown.
    const paidOn = parseOptionalDateInput(body.paidOn);
    if (paidOn === undefined) {
      return NextResponse.json({ error: "paidOn must be a date or empty" }, { status: 400 });
    }
    for (const entry of entries) {
      if (!entry.contributorName || entry.amount === undefined || Number(entry.amount) <= 0) {
        return NextResponse.json(
          { error: "Each entry needs a contributorName and a positive amount" },
          { status: 400 }
        );
      }
    }

    const created = await prisma.$transaction(
      entries.map((entry: { contributorName: string; amount: number }) =>
        prisma.contribution.create({
          data: {
            date: new Date(date),
            paidOn,
            label: String(label).trim(),
            amount: Number(entry.amount),
            contributor: {
              connectOrCreate: {
                where: { name: String(entry.contributorName).trim() },
                create: { name: String(entry.contributorName).trim() },
              },
            },
          },
        })
      )
    );

    // Outlay is always recorded in SGD.
    const totalAmount = entries.reduce(
      (sum: number, e: { amount: number }) => sum + Number(e.amount),
      0
    );
    await adjustCashBalance("SGD", totalAmount);

    return NextResponse.json(created, { status: 201 });
  }

  const { contributorName, label, date, amount } = body;

  if (!contributorName || !label || !date || amount === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const paidOn = parseOptionalDateInput(body.paidOn);
  if (paidOn === undefined) {
    return NextResponse.json({ error: "paidOn must be a date or empty" }, { status: 400 });
  }

  const contributor = await prisma.contributor.upsert({
    where: { name: String(contributorName).trim() },
    update: {},
    create: { name: String(contributorName).trim() },
  });

  const contribution = await prisma.contribution.create({
    data: {
      contributorId: contributor.id,
      label: String(label).trim(),
      date: new Date(date),
      paidOn,
      amount: Number(amount),
    },
  });

  await adjustCashBalance("SGD", Number(amount));

  return NextResponse.json(contribution, { status: 201 });
}
