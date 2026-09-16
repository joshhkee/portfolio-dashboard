import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adjustCashBalance } from "@/lib/cash";

const VALID_CURRENCIES = ["SGD", "USD", "HKD"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fromCurrency, fromAmount, toCurrency, toAmount, auto } = body;

  if (!VALID_CURRENCIES.includes(fromCurrency) || !VALID_CURRENCIES.includes(toCurrency)) {
    return NextResponse.json({ error: "Currencies must be SGD, USD, or HKD" }, { status: 400 });
  }
  if (fromCurrency === toCurrency) {
    return NextResponse.json({ error: "Pick two different currencies" }, { status: 400 });
  }
  if (Number(fromAmount) <= 0 || Number(toAmount) <= 0) {
    return NextResponse.json({ error: "Amounts must be positive" }, { status: 400 });
  }

  // Soft tracking, same as buys/sells — an exchange is never blocked for
  // insufficient balance in the source currency.
  await adjustCashBalance(fromCurrency, -Number(fromAmount));
  await adjustCashBalance(toCurrency, Number(toAmount));

  const exchange = await prisma.cashExchange.create({
    data: {
      fromCurrency,
      fromAmount: Number(fromAmount),
      toCurrency,
      toAmount: Number(toAmount),
      rate: Number(toAmount) / Number(fromAmount),
      auto: Boolean(auto),
    },
  });

  return NextResponse.json(exchange, { status: 201 });
}
