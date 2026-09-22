import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";
import { mapWithConcurrency } from "@/lib/concurrency";
import { correlationMatrix } from "@/lib/risk";
import { getNameMap } from "@/lib/ticker-meta";
import {
  fetchHistoricalCloses,
  priceKey,
  toYahooSymbol,
  type HistoricalCloses,
} from "@/lib/prices";

export const dynamic = "force-dynamic";

/** Six months of dates: enough overlapping trading days for a stable pairwise
 * correlation, without asking Yahoo for years of history on every cold read. */
const RANGE = "6mo";

/** Same politeness budget as the sparkline fetcher — see lib/concurrency.ts. */
const CONCURRENCY = 4;

/**
 * Pairwise correlation of daily returns across the OPEN positions.
 *
 * The ticker list is derived from the ledger server-side rather than accepted
 * from the client, which keeps the request small (no 18-key query string to
 * forge) and means the matrix always describes what is actually held.
 *
 * Each symbol goes through fetchHistoricalCloses, which is already behind
 * Next's own fetch cache, so reopening this panel inside the hour is free.
 * The work that remains here is bounded by position count and CONCURRENCY.
 */
export async function GET() {
  const [transactions, names] = await Promise.all([
    // Derived from the transaction ledger, like every other position in this
    // app — there is no stored position table to read, and there shouldn't be
    // one: a stored balance is a second source of truth free to drift.
    prisma.transaction.findMany(),
    // Names come from the TickerMeta cache, so labelling the matrix costs no
    // extra network calls.
    getNameMap(),
  ]);

  const { openPositions } = computeLedger(fromDbRows(transactions));

  const unique = new Map<string, { region: string; ticker: string }>();
  for (const row of openPositions) {
    if (!row.region || !row.ticker || row.qty <= 0) continue;
    unique.set(priceKey(row.region, row.ticker), row);
  }
  const entries = Array.from(unique.entries());
  if (entries.length < 2) {
    return NextResponse.json({ matrix: { keys: [], matrix: [], observations: 0 }, names: {} });
  }

  const fetched = await mapWithConcurrency(entries, CONCURRENCY, async ([key, row]) => {
    const closes = await fetchHistoricalCloses(toYahooSymbol(row.region, row.ticker), RANGE);
    return [key, closes] as const;
  });

  const closes: Record<string, HistoricalCloses> = {};
  for (const [key, series] of fetched) {
    if (Object.keys(series).length >= 2) closes[key] = series;
  }

  return NextResponse.json({ matrix: correlationMatrix(closes), names });
}
