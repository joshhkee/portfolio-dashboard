import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchQuotesForPositions } from "@/lib/prices";

export const dynamic = "force-dynamic";

const REGIONS = ["US", "SG", "HK"];

export async function GET() {
  const items = await prisma.watchlistItem.findMany({ orderBy: { createdAt: "asc" } });
  const quotes = await fetchQuotesForPositions(
    items.map((i) => ({ region: i.region, ticker: i.ticker }))
  );

  const rows = items.map((i) => {
    const price = quotes[`${i.region}::${i.ticker}`] ?? null;
    return {
      id: i.id,
      region: i.region,
      ticker: i.ticker,
      notes: i.notes,
      price,
    };
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, region, notes } = body;

  if (!ticker || typeof ticker !== "string") {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  const normalizedTicker = ticker.toUpperCase().trim();
  const normalizedRegion = String(region ?? "").toUpperCase().trim();
  if (!REGIONS.includes(normalizedRegion)) {
    return NextResponse.json({ error: "region must be US, SG, or HK" }, { status: 400 });
  }

  const existing = await prisma.watchlistItem.findUnique({
    where: { region_ticker: { region: normalizedRegion, ticker: normalizedTicker } },
  });
  if (existing) {
    return NextResponse.json({ error: `${normalizedTicker} (${normalizedRegion}) is already on the watchlist` }, { status: 409 });
  }

  const item = await prisma.watchlistItem.create({
    data: {
      ticker: normalizedTicker,
      region: normalizedRegion,
      notes: notes ? String(notes).trim() || null : null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await prisma.watchlistItem.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
