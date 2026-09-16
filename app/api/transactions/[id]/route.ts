import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromDbRows, findFirstNegativeQty, type DbTransactionRow } from "@/lib/portfolio-engine";
import { currencyForRegion } from "@/lib/fx";
import { adjustCashBalance } from "@/lib/cash";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  await prisma.transaction.delete({ where: { id } });

  // Reverse this transaction's cash effect: a deleted Buy gives cash
  // back, a deleted Sell takes the proceeds back out.
  const reverseDelta = (existing.action === "Buy" ? 1 : -1) * existing.qty * existing.price;
  await adjustCashBalance(currencyForRegion(existing.region), reverseDelta);

  return NextResponse.json({ ok: true });
}

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

  const existingRaw = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  if (!existingRaw.some((t: DbTransactionRow) => t.id === id)) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Re-run the full ledger with this row's edited fields swapped in — an
  // edit to a Buy's qty/date can push a *later* Sell negative even though
  // the edited row itself isn't the Sell, so we can't just check the
  // edited row in isolation the way the POST (new transaction) guard does.
  const existing = fromDbRows(existingRaw);
  const candidateSet = existing.map((t) =>
    t.id === id
      ? {
          id,
          date: new Date(date),
          action: action as "Buy" | "Sell",
          ticker: normalizedTicker,
          region: normalizedRegion,
          qty: Number(qty),
          price: Number(price),
          notes: notes ? String(notes) : null,
        }
      : t
  );
  const violation = findFirstNegativeQty(candidateSet);
  if (violation) {
    return NextResponse.json(
      {
        error: `This edit would leave ${violation.ticker} (${violation.region}) at a negative quantity (${violation.runningQty.toFixed(4)}) at some point in the ledger — check the ticker, region, qty, or date.`,
      },
      { status: 400 }
    );
  }

  const transaction = await prisma.transaction.update({
    where: { id },
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

  // Reverse the old cash effect and apply the new one — handles a
  // changed qty/price/action, and a changed region (reverses against
  // the OLD region's currency, applies against the NEW one).
  const oldTxn = existing.find((t) => t.id === id)!;
  const oldDelta = (oldTxn.action === "Buy" ? -1 : 1) * oldTxn.qty * oldTxn.price;
  const newDelta = (action === "Buy" ? -1 : 1) * Number(qty) * Number(price);
  await adjustCashBalance(currencyForRegion(oldTxn.region), -oldDelta);
  await adjustCashBalance(currencyForRegion(normalizedRegion), newDelta);

  return NextResponse.json(transaction);
}
