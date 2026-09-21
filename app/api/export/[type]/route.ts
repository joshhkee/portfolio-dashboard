import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeLedger, fromDbRows } from "@/lib/portfolio-engine";

export const dynamic = "force-dynamic";

/** Escape a value for RFC 4180 CSV: quote when it contains a comma,
 * quote, or newline; double any embedded quotes. */
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // \r\n per RFC 4180; BOM so Excel opens UTF-8 correctly.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function csvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "transactions") {
    const raw = await prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] });
    const { ledger } = computeLedger(fromDbRows(raw));
    const csv = toCsv(
      ["id", "date", "action", "ticker", "region", "qty", "price", "transactionValue", "runningQty", "runningAvgCost", "notes"],
      ledger.map((t) => [
        t.id, isoDate(t.date), t.action, t.ticker, t.region, t.qty, t.price,
        t.transactionValue.toFixed(2), t.runningQty, t.runningAvgCost.toFixed(4), t.notes ?? "",
      ])
    );
    return csvResponse(`transactions-${stamp}.csv`, csv);
  }

  if (type === "contributions") {
    const rows = await prisma.contribution.findMany({
      include: { contributor: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    const csv = toCsv(
      ["id", "date", "contributor", "label", "amount"],
      rows.map((c) => [c.id, isoDate(c.date), c.contributor.name, c.label, c.amount.toFixed(2)])
    );
    return csvResponse(`contributions-${stamp}.csv`, csv);
  }

  if (type === "completed-trades") {
    const raw = await prisma.transaction.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] });
    const { completedTrades } = computeLedger(fromDbRows(raw));
    const csv = toCsv(
      ["sellDate", "ticker", "region", "qtySold", "avgCost", "sellPrice", "realizedPL", "returnPct", "notes"],
      completedTrades.map((t) => [
        isoDate(t.sellDate), t.ticker, t.region, t.qtySold, t.avgCost.toFixed(4),
        t.sellPrice.toFixed(4), t.realizedPL.toFixed(2), (t.returnPct * 100).toFixed(2) + "%", t.notes ?? "",
      ])
    );
    return csvResponse(`completed-trades-${stamp}.csv`, csv);
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
}
