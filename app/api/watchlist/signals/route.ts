import { NextRequest, NextResponse } from "next/server";
import { getEntryAnalysis, parseSignalKeys } from "@/lib/entry-signals";

export const dynamic = "force-dynamic";

/**
 * Entry-timing signals for a set of watchlist keys, in ONE request.
 *
 * Batched for the same reason `/api/sparklines` is: the watchlist is a handful
 * of rows, a request per row is a waterfall, and a year of daily bars per
 * ticker is the most expensive thing this page asks for. `getEntryAnalysis`
 * bounds the symbols per request, runs four fetches at a time, and serves
 * repeats from an hour of cache.
 *
 * The response carries the computed measures (`signals`) AND the closes they
 * were computed from (`series`), because the row's chart draws the same year —
 * two endpoints would mean two fetches and two ways for the picture and the
 * numbers beside it to disagree.
 *
 * Protected by the same auth middleware as every other route: the matcher only
 * exempts /login and /api/login, so this needs the session cookie too.
 */
export async function GET(req: NextRequest) {
  const keys = parseSignalKeys(req.nextUrl.searchParams.get("keys") ?? "");
  if (keys.length === 0) return NextResponse.json({ signals: {}, series: {} });

  const { signals, series } = await getEntryAnalysis(keys);
  return NextResponse.json({ signals, series });
}
