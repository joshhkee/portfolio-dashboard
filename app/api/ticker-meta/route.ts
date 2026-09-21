import { NextRequest, NextResponse } from "next/server";
import { getNameMap, setTickerNameOverride } from "@/lib/ticker-meta";

export const dynamic = "force-dynamic";

const REGIONS = ["US", "SG", "HK"];

export async function GET() {
  return NextResponse.json({ names: await getNameMap() });
}

/**
 * Hand-edit an instrument's display name. Once set, the value is marked as
 * overridden and no automatic lookup will replace it — see mergeMeta() in
 * lib/ticker-meta.ts. Sending a blank/whitespace name clears the override and
 * hands the instrument back to auto-lookup.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ticker = typeof body.ticker === "string" ? body.ticker.toUpperCase().trim() : "";
  const region = typeof body.region === "string" ? body.region.toUpperCase().trim() : "";

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (!REGIONS.includes(region)) {
    return NextResponse.json({ error: "region must be US, SG, or HK" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : null;
  await setTickerNameOverride(region, ticker, name);

  return NextResponse.json({ ok: true, region, ticker, name: name?.trim() || null });
}
