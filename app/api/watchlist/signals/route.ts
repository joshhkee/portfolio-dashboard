import { NextRequest, NextResponse } from "next/server";
import { getEntrySignals, parseSignalKeys } from "@/lib/entry-signals";

export const dynamic = "force-dynamic";

/**
 * Entry-timing signals for a set of watchlist keys, in ONE request.
 *
 * Batched for the same reason `/api/sparklines` is: the watchlist is a handful
 * of rows, a request per row is a waterfall, and a year of daily bars per
 * ticker is the most expensive thing this page asks for. `getEntrySignals`
 * bounds the symbols per request, runs four fetches at a time, and serves
 * repeats from an hour of cache.
 *
 * Protected by the same auth middleware as every other route: the matcher only
 * exempts /login and /api/login, so this needs the session cookie too.
 */
export async function GET(req: NextRequest) {
  const keys = parseSignalKeys(req.nextUrl.searchParams.get("keys") ?? "");
  if (keys.length === 0) return NextResponse.json({ signals: {} });

  const signals = await getEntrySignals(keys);
  return NextResponse.json({ signals });
}
