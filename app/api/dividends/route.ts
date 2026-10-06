import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currencyForRegion, type Currency } from "@/lib/fx";
import { getSgdRateSeries, sgdRateOn } from "@/lib/fx-history";
import { parseDividendDate } from "@/lib/dividends";

export const dynamic = "force-dynamic";

const REGIONS = ["US", "SG", "HK"] as const;

export async function GET() {
  const dividends = await prisma.dividend.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] });
  return NextResponse.json(dividends);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const region = String(body?.region ?? "").toUpperCase().trim();
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const date = parseDividendDate(body?.date);
  const amount = Number(body?.amount);
  const withholding = body?.withholding === undefined || body.withholding === "" ? 0 : Number(body.withholding);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null;

  if (!REGIONS.includes(region as (typeof REGIONS)[number]) || !ticker || ticker.length > 32) {
    return NextResponse.json({ error: "Choose a valid market and enter a ticker" }, { status: 400 });
  }
  if (!date || !Number.isFinite(date.getTime())) {
    return NextResponse.json({ error: "Enter a valid payment date" }, { status: 400 });
  }
  if (date.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "Payment date cannot be in the future" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(withholding) || withholding < 0) {
    return NextResponse.json({ error: "Net amount must be positive and withholding cannot be negative" }, { status: 400 });
  }

  const currency = currencyForRegion(region) as Currency;
  const dateKey = date.toISOString().slice(0, 10);
  const rate = currency === "SGD"
    ? 1
    : sgdRateOn(await getSgdRateSeries(), currency, dateKey);
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "No historical exchange rate is available for that date" }, { status: 422 });
  }
  const amountSgd = amount * rate;
  if (!Number.isFinite(amountSgd)) {
    return NextResponse.json({ error: "Converted SGD amount is outside the supported range" }, { status: 400 });
  }

  const dividend = await prisma.$transaction(async (tx) => {
    const created = await tx.dividend.create({
      data: { date, region, ticker, amount, currency, amountSgd, withholding, notes },
    });
    await tx.cashBalance.upsert({
      where: { currency },
      update: { balance: { increment: amount } },
      create: { currency, balance: amount },
    });
    return created;
  });

  return NextResponse.json(dividend, { status: 201 });
}
