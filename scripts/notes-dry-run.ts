// Dry run for the notes cleanup — READ ONLY, writes nothing.
//
// Part 8 (notes redesign) splits the `notes` column into the two jobs it was
// doing: the instrument's name (reference data, now redundant because
// `TickerMeta` caches it and the UI renders it under the ticker) and a person's
// own words (context, which must be protected). The DISPLAY half is already
// live — `classifyNote()` decides per row whether a stored note is shown.
//
// This script is the other half: it prints exactly what a one-time rewrite of
// the stored text WOULD change, so the owner can approve or reject it row by
// row before anything is written. Nothing here touches the database — it is a
// `findMany` and a `console.log`.
//
//   npm run notes:dry-run
//
// Three buckets, and only the first two are removal candidates:
//
//   NAME       the note is the instrument's name; it can be cleared, because
//              the name is already on screen from the lookup cache.
//   RESTATES   the note repeats the action ("Second Buy", "Sell All") that the
//              ledger line now derives from the row itself. Redundant, but the
//              owner wrote it on purpose, so it is the owner's call.
//   KEEPS      the note says something the app cannot derive: a stop level, a
//              DCA amount, an alias or a plan level. Untouched, always.

import { PrismaClient } from "@prisma/client";
import { classifyNote, noteBodyAfterTicker } from "../lib/notes";

/** Words that only restate the action. A note made of nothing else adds no
 *  information the derived ledger line does not already state — but any digit
 *  disqualifies it, because a digit is a detail (a level, an amount, a share
 *  count) that only the note carries. */
const RESTATEMENT_WORDS = new Set([
  "buy",
  "bought",
  "sell",
  "sold",
  "second",
  "third",
  "fourth",
  "fifth",
  "full",
  "all",
  "part",
  "partial",
  "avg",
  "average",
  "down",
  "odd",
  "lot",
  "exit",
  "closed",
  "close",
  "opening",
  "remaining",
]);

type Bucket = "NAME" | "RESTATES" | "KEEPS";

function bucketOf(raw: string, ticker: string, name: string | null): Bucket {
  if (classifyNote(raw, { ticker, name }).kind === "reference") return "NAME";
  const body = noteBodyAfterTicker(raw, ticker) ?? raw;
  if (!/\d/.test(body)) {
    const words = body
      .toLowerCase()
      .replace(/[^a-z]+/g, " ")
      .split(" ")
      .filter(Boolean);
    if (words.length > 0 && words.every((w) => RESTATEMENT_WORDS.has(w))) return "RESTATES";
  }
  return "KEEPS";
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const [rows, meta] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          date: true,
          action: true,
          ticker: true,
          region: true,
          notes: true,
        },
      }),
      prisma.tickerMeta.findMany({
        select: { region: true, ticker: true, name: true },
      }),
    ]);

    const names = new Map(meta.map((m) => [`${m.region}::${m.ticker}`, m.name]));
    const counts: Record<Bucket, number> = { NAME: 0, RESTATES: 0, KEEPS: 0 };
    const lines: string[] = [];

    for (const row of rows) {
      const name = names.get(`${row.region}::${row.ticker}`) ?? null;
      const note = (row.notes ?? "").trim();
      const bucket = note ? bucketOf(note, row.ticker, name) : "KEEPS";
      counts[bucket]++;
      const day = row.date.toISOString().slice(0, 10);
      lines.push(
        [
          bucket.padEnd(9),
          `#${String(row.id).padStart(3)}`,
          day,
          row.region,
          row.ticker.padEnd(6),
          note ? JSON.stringify(note) : "(empty)",
        ].join("  ")
      );
    }

    console.log(lines.join("\n"));
    console.log("");
    console.log(`rows            ${rows.length}`);
    console.log(`NAME            ${counts.NAME}  (a rewrite would clear these)`);
    console.log(`RESTATES        ${counts.RESTATES}  (redundant with the derived line; owner's call)`);
    console.log(`KEEPS           ${counts.KEEPS}  (untouched, always)`);
    console.log("");
    console.log("DRY RUN — nothing was written.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
