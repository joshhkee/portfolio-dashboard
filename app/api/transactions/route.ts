import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows, findNegativeQtyAfter } from "@/lib/portfolio-engine";

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, action, ticker, region, qty, price, notes } = body;

  if (!date || !action || !ticker || !region || qty === undefined || price === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (action !== "Buy" && action !== "Sell") {
    return NextResponse.json({ error: "action must be 'Buy' or 'Sell'" }, { status: 400 });
  }
  if (Number(qty) <= 0 || Number(price) <= 0) {
    return NextResponse.json({ error: "qty and price must be positive" }, { status: 400 });
  }

  const normalizedTicker = String(ticker).toUpperCase().trim();
  const normalizedRegion = String(region).toUpperCase().trim();

  if (action === "Sell") {
    const existingRaw = await prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    const existing = fromDbRows(existingRaw);
    const maxId = existing.reduce((max, t) => Math.max(max, t.id), 0);
    const resultingQty = findNegativeQtyAfter(existing, {
      id: maxId + 1,
      date: new Date(date),
      action: "Sell",
      ticker: normalizedTicker,
      region: normalizedRegion,
      qty: Number(qty),
      price: Number(price),
      notes: null,
    });
    if (resultingQty !== null) {
      const { openPositions } = computeLedger(existing);
      const held =
        openPositions.find((p) => p.ticker === normalizedTicker && p.region === normalizedRegion)
          ?.qty ?? 0;
      return NextResponse.json(
        {
          error: `This would leave a negative position (${resultingQty.toFixed(4)}). You hold ${held} of ${normalizedTicker} (${normalizedRegion}) as of the transactions on record — check the ticker, region, qty, or date.`,
        },
        { status: 400 }
      );
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      date: new Date(date),
      action,
      ticker: normalizedTicker,
      region: normalizedRegion,
      qty: Number(qty),
      price: Number(price),
      notes: notes ? String(notes) : null,
    },
  });

  return NextResponse.json(transaction, { status: 201 });
}