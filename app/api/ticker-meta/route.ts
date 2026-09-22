import { NextRequest, NextResponse } from "next/server";
import { getTickerMetaMaps, setTickerNameOverride, setTickerSector } from "@/lib/ticker-meta";

export const dynamic = "force-dynamic";

const REGIONS = ["US", "SG", "HK"];

export async function GET() {
  const { names, sectors } = await getTickerMetaMaps();
  return NextResponse.json({ names, sectors });
}

/**
 * Hand-edit an instrument's reference data: its display name, its exposure
 * tag, or both.
 *
 * A field is only touched when the request actually CONTAINS it — presence,
 * not truthiness. Otherwise a sector-only edit would carry `name: undefined`
 * and wipe a hand-corrected name as a side effect, which is the kind of
 * data loss that is invisible until someone notices a name has reverted.
 *
 * Name semantics: once set, a name is marked as overridden and no automatic
 * lookup will replace it (see mergeMeta in lib/ticker-meta.ts); a blank name
 * clears the override and hands the instrument back to auto-lookup. Sector
 * semantics: hand-entered only, and blank clears it back to "unclassified".
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

  const hasName = "name" in body;
  const hasSector = "sector" in body;
  if (!hasName && !hasSector) {
    return NextResponse.json(
      { error: "nothing to update — send name, sector, or both" },
      { status: 400 }
    );
  }

  if (hasName) {
    await setTickerNameOverride(region, ticker, typeof body.name === "string" ? body.name : null);
  }
  if (hasSector) {
    await setTickerSector(region, ticker, typeof body.sector === "string" ? body.sector : null);
  }

  return NextResponse.json({
    ok: true,
    region,
    ticker,
    name: hasName ? (typeof body.name === "string" ? body.name.trim() || null : null) : undefined,
    sector: hasSector
      ? (typeof body.sector === "string" ? body.sector.trim().replace(/\s+/g, " ") || null : null)
      : undefined,
  });
}
