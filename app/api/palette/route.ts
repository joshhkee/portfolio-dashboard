import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceKey } from "@/lib/prices";
import { getNameMap } from "@/lib/ticker-meta";

export const dynamic = "force-dynamic";

/**
 * Every instrument the command palette can jump to: anything ever traded, plus
 * whatever is on the watchlist.
 *
 * The ledger is read rather than only the open positions, because looking up a
 * position that was already sold is a legitimate thing to want from a search
 * palette — and the *page* it navigates to is what decides whether a
 * closed position is worth showing.
 *
 * Deliberately DB-only: names come from the TickerMeta cache
 * (lib/ticker-meta.ts), which is populated by the price pipeline, so opening
 * the palette costs zero Yahoo requests.
 */
export async function GET() {
  const [transactions, watchlist, names] = await Promise.all([
    prisma.transaction.findMany({ select: { region: true, ticker: true } }),
    prisma.watchlistItem.findMany({ select: { region: true, ticker: true } }),
    getNameMap(),
  ]);

  const seen = new Map<string, { region: string; ticker: string; name: string | null }>();
  for (const row of [...transactions, ...watchlist]) {
    const key = priceKey(row.region, row.ticker);
    if (seen.has(key)) continue;
    seen.set(key, { region: row.region, ticker: row.ticker, name: names[key] ?? null });
  }

  const tickers = Array.from(seen.values()).sort(
    (a, b) => a.region.localeCompare(b.region) || a.ticker.localeCompare(b.ticker)
  );

  return NextResponse.json({ tickers });
}
