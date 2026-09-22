import { NextRequest, NextResponse } from "next/server";
import { getSparklines, parseSparklineKeys } from "@/lib/sparklines";

export const dynamic = "force-dynamic";

/**
 * 30-day sparkline series for a set of keys — all of them in ONE request.
 *
 * Batched on purpose: a positions page has ~18 rows, and an endpoint per row
 * would mean 18 requests every time the page is opened, each waking a Yahoo
 * call. Here they arrive together, the cap in `parseSparklineKeys` bounds the
 * work, and getSparklines() serves repeats from a 15-minute cache with at most
 * four Yahoo requests in flight.
 *
 * The query accepts both "REGION::TICKER" (what priceKey() builds, and what the
 * response is keyed by) and the older "REGION:TICKER" — see
 * lib/sparklines.ts's parseSparklineKeys for the bug that made both necessary.
 *
 * Protected by the same auth middleware as every other route: the matcher only
 * exempts /login and /api/login, so this needs the session cookie too.
 */
export async function GET(req: NextRequest) {
  const keys = parseSparklineKeys(req.nextUrl.searchParams.get("keys") ?? "");
  if (keys.length === 0) return NextResponse.json({ series: {} });

  const series = await getSparklines(keys);
  return NextResponse.json({ series });
}
