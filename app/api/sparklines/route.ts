import { NextRequest, NextResponse } from "next/server";
import { getSparklines, MAX_SPARKLINE_KEYS, type SparklineKey } from "@/lib/sparklines";

export const dynamic = "force-dynamic";

/**
 * 30-day sparkline series for a set of "REGION:TICKER" keys — all of them in
 * ONE request.
 *
 * Batched on purpose: a positions page has ~18 rows, and an endpoint per row
 * would mean 18 requests every time the page is opened, each waking a Yahoo
 * call. Here they arrive together, the cap below bounds the work, and
 * getSparklines() serves repeats from a 15-minute cache with at most four
 * Yahoo requests in flight.
 *
 * Protected by the same auth middleware as every other route: the matcher only
 * exempts /login and /api/login, so this needs the session cookie too.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("keys") ?? "";

  const keys: SparklineKey[] = [];
  for (const part of raw.split(",")) {
    const [region, ticker] = part.split(":");
    if (region && ticker) keys.push({ region: region.trim(), ticker: ticker.trim() });
    if (keys.length >= MAX_SPARKLINE_KEYS) break;
  }

  if (keys.length === 0) return NextResponse.json({ series: {} });

  const series = await getSparklines(keys);
  return NextResponse.json({ series });
}
