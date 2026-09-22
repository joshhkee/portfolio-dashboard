// The one-time notes cleanup — DRY RUN unless you ask it to write.
//
//   npm run notes:cleanup                      # print what would change
//   npm run notes:cleanup -- --apply           # write it (backs up first)
//   npm run notes:cleanup -- --revert FILE     # put every note back
//
// Why this exists: the `notes` column held two jobs at once. 60 of the 64 rows
// carried the instrument's name, which `TickerMeta` already caches and the UI
// renders under the ticker, and the rest were mostly a restatement of what the
// ledger now derives for itself. The owner reviewed the dry run row by row on
// 2026-09-23 and decided which notes survive; `lib/notes-cleanup.ts` holds those
// verdicts as a pure function, `tests/notes-cleanup.test.ts` pins them against
// all 64 stored notes, and this script is only the part that reads and writes.
//
// --apply writes `notes-backup-<timestamp>.json` (every row's id and old note)
// BEFORE it changes anything, so `--revert` can put the column back exactly as
// it was. That file is untracked: keep it until you are satisfied, then delete
// it. It contains note text only — no secret values.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, readFileSync } from "node:fs";
import { planNoteChange, type CleanupReason } from "../lib/notes-cleanup";

const REASON_ORDER: CleanupReason[] = [
  "reference",
  "reviewed-name",
  "restates-action",
  "achieved-average",
  "odd-lot",
  "dca-month",
  "keep",
];

interface Row {
  id: number;
  date: Date;
  ticker: string;
  region: string;
  notes: string | null;
}

async function loadRows(prisma: PrismaClient): Promise<Row[]> {
  return prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true, date: true, ticker: true, region: true, notes: true },
  });
}

async function nameMap(prisma: PrismaClient) {
  const meta = await prisma.tickerMeta.findMany({
    select: { region: true, ticker: true, name: true },
  });
  return new Map(meta.map((m) => [`${m.region}::${m.ticker}`, m.name]));
}

function show(value: string | null): string {
  return value === null ? "(none)" : JSON.stringify(value);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const revertAt = args.indexOf("--revert");
  const prisma = new PrismaClient();

  try {
    if (revertAt !== -1) {
      const file = args[revertAt + 1];
      if (!file) {
        console.error("Usage: npm run notes:cleanup -- --revert notes-backup-<timestamp>.json");
        process.exitCode = 1;
        return;
      }
      const backup = JSON.parse(readFileSync(file, "utf8")) as Array<{
        id: number;
        notes: string | null;
      }>;
      await prisma.$transaction(
        backup.map((row) =>
          prisma.transaction.update({ where: { id: row.id }, data: { notes: row.notes } })
        )
      );
      console.log(`Reverted ${backup.length} notes from ${file}.`);
      return;
    }

    const [rows, names] = await Promise.all([loadRows(prisma), nameMap(prisma)]);
    const plans = rows.map((row) => ({
      row,
      plan: planNoteChange(row.notes, {
        ticker: row.ticker,
        name: names.get(`${row.region}::${row.ticker}`) ?? null,
        date: row.date,
      }),
    }));

    const counts = new Map<CleanupReason, number>();
    for (const { plan } of plans) counts.set(plan.reason, (counts.get(plan.reason) ?? 0) + 1);

    const changed = plans.filter(({ plan }) => plan.changed);
    for (const { row, plan } of changed) {
      const day = row.date.toISOString().slice(0, 10);
      console.log(
        [
          plan.reason.padEnd(17),
          `#${String(row.id).padStart(3)}`,
          day,
          row.region,
          row.ticker.padEnd(6),
          show(plan.before),
          "->",
          show(plan.after),
        ].join("  ")
      );
    }

    console.log("");
    console.log("kept unchanged:");
    for (const { row, plan } of plans.filter(({ plan }) => !plan.changed)) {
      console.log(`  #${String(row.id).padStart(3)}  ${row.ticker.padEnd(6)} ${show(plan.before)}`);
    }

    console.log("");
    console.log(`rows         ${rows.length}`);
    for (const reason of REASON_ORDER) {
      const n = counts.get(reason) ?? 0;
      if (n === 0) continue;
      console.log(`${reason.padEnd(17)} ${n}`);
    }
    console.log("");
    // Deliberately counts only rows that would MOVE, so a second run reads
    // "0 / 0 / 64" and is obviously a no-op.
    console.log(`would clear   ${changed.filter(({ plan }) => plan.after === null).length}`);
    console.log(`would rewrite ${changed.filter(({ plan }) => plan.after !== null).length}`);
    console.log(`untouched     ${plans.filter(({ plan }) => !plan.changed).length}`);

    if (!apply) {
      console.log("");
      console.log("DRY RUN — nothing was written. Re-run with `-- --apply` to write it.");
      return;
    }

    // Back up every row's CURRENT note before touching any of them, so the
    // revert path does not depend on this script's rules still existing.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `notes-backup-${stamp}.json`;
    writeFileSync(
      backupFile,
      JSON.stringify(rows.map((r) => ({ id: r.id, notes: r.notes })), null, 2)
    );
    console.log(`\nbackup written: ${backupFile}`);

    await prisma.$transaction(
      changed.map(({ row, plan }) =>
        prisma.transaction.update({ where: { id: row.id }, data: { notes: plan.after } })
      )
    );
    console.log(`Wrote ${changed.length} notes.`);
    console.log(`To undo: npm run notes:cleanup -- --revert ${backupFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
