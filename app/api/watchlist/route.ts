import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchPositionQuotes } from "@/lib/prices";
import { ensureTickerMeta, getNameMap, type TickerMetaEntry } from "@/lib/ticker-meta";
import { watchlistRows } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

const REGIONS = ["US", "SG", "HK"];

/** Every watchlist row, resolved the same way the page resolves them (one
 *  shared builder, so a refresh cannot disagree with the first render). */
async function loadRows() {
  const items = await prisma.watchlistItem.findMany({ orderBy: { createdAt: "asc" } });
  const quotes = await fetchPositionQuotes(
    items.map((i) => ({ region: i.region, ticker: i.ticker }))
  );
  const entries: TickerMetaEntry[] = [];
  for (const item of items) {
    const meta = quotes.meta[`${item.region}::${item.ticker}`];
    if (meta) entries.push({ region: item.region, ticker: item.ticker, meta });
  }
  await ensureTickerMeta(entries);
  return watchlistRows(
    items.map((i) => ({
      id: i.id,
      region: i.region,
      ticker: i.ticker,
      notes: i.notes,
      targetBuyPrice: i.targetBuyPrice,
      targetAllocPct: i.targetAllocPct,
    })),
    quotes,
    await getNameMap()
  );
}

export async function GET() {
  return NextResponse.json({ items: await loadRows() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, region, notes, targetBuyPrice, targetAllocPct } = body;

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

  const cleanTargetBuy =
    typeof targetBuyPrice === "number" && targetBuyPrice > 0
      ? targetBuyPrice
      : typeof targetBuyPrice === "string" && Number(targetBuyPrice) > 0
        ? Number(targetBuyPrice)
        : null;

  const cleanAlloc =
    typeof targetAllocPct === "number" && targetAllocPct > 0
      ? targetAllocPct
      : typeof targetAllocPct === "string" && Number(targetAllocPct) > 0
        ? Number(targetAllocPct)
        : null;

  const item = await prisma.watchlistItem.create({
    data: {
      ticker: normalizedTicker,
      region: normalizedRegion,
      notes: notes ? String(notes).trim() || null : null,
      targetBuyPrice: cleanTargetBuy,
      targetAllocPct: cleanAlloc,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

/** Set a row's note.
 *
 * The field is "why I am watching this", which is only useful if it can be
 * written after the ticker was added — the add form is not a place you have a
 * reason in mind. Blank clears it back to null rather than storing "". */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: {
    notes?: string | null;
    targetBuyPrice?: number | null;
    targetAllocPct?: number | null;
  } = {};

  if (body?.notes !== undefined) {
    data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (body?.targetBuyPrice !== undefined) {
    const num = Number(body.targetBuyPrice);
    data.targetBuyPrice = Number.isFinite(num) && num > 0 ? num : null;
  }

  if (body?.targetAllocPct !== undefined) {
    const num = Number(body.targetAllocPct);
    data.targetAllocPct = Number.isFinite(num) && num > 0 ? num : null;
  }

  const updated = await prisma.watchlistItem
    .update({
      where: { id },
      data,
      select: { id: true, notes: true, targetBuyPrice: true, targetAllocPct: true },
    })
    .catch(() => null);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(updated);
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
