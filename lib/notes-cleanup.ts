// The one-time notes cleanup: what each stored note should become.
//
// This is a MIGRATION AID, not runtime code. `lib/notes.ts` decides what to
// DISPLAY and is deliberately conservative about hiding anything it cannot
// verify. This module is the opposite: it holds the owner's explicit verdicts on
// what the `notes` column should keep, so a script can rewrite the rows once,
// and the rules can be tested against the real ledger before anything is
// written.
//
// The owner reviewed the dry run row by row on 2026-09-23 and decided:
//
//   - The instrument's NAME is not a note; the ticker line renders it. That
//     includes the four notes that only LOOK like the name in a form the lookup
//     does not state — two misspellings, one alias, one abbreviation — for which
//     the verdict was "clear them, fix the name in the lookup instead" and then
//     "no name changes at all": the notes go and the ticker keeps the lookup's
//     official name. No heuristic can tell `Proctor & Gamble` (a typo worth
//     deleting) from `Odd Lot` (two words worth keeping), which is why those
//     four are listed by their exact stored text instead of being inferred.
//   - An ORDINAL or a restated action is not a note either. The derived ledger
//     line says what the row did — including the new average cost, which is what
//     the owner reads a "Second Buy" note for. `Odd Lot` is the exception and is
//     kept, because which board a Singapore trade used is recorded nowhere else.
//   - A partial sell's FRACTION is derived (`Sold 8 of 15`), so a note that only
//     restates it goes.
//   - `Avg down to x10@$263.25` is the average actually achieved, not a target,
//     so it is derived too (the Avg cost column holds it) and the note goes.
//   - DCA notes collapse to one consistent form naming the ALLOCATION MONTH,
//     which is the part the app cannot derive from the trade date. "Brought
//     forward" is dropped: the owner wants the month on every DCA row, nothing
//     else.
//   - Stop-loss / take-profit notes stay, verbatim. They are a plan with prices
//     in it (`DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)`) and nothing else
//     stores them; a later pass may model the levels properly.
//
// Anything the verdicts do not cover is left alone — the default is KEEP.

import { classifyNote } from "@/lib/notes";
import { formatMonthYear } from "@/lib/dates";

/** Why a note is being changed, so the dry run can group the rewrites and the
 *  result can be checked against the owner's decisions. */
export type CleanupReason =
  | "reference"
  | "reviewed-name"
  | "restates-action"
  | "odd-lot"
  | "dca-month"
  | "achieved-average"
  | "keep";

export interface NotePlan {
  /** The stored text as it is now. */
  before: string;
  /** What it should become: the new text, or null for "no note". */
  after: string | null;
  reason: CleanupReason;
  /** True when the stored row needs writing. */
  changed: boolean;
}

/**
 * Notes the owner reviewed individually as "just the name, clear it".
 *
 * Matched on the exact stored text. These are the cases where the classifier in
 * `lib/notes.ts` refuses to call a note reference data — it cannot verify a
 * misspelling or an alias against the cached name — and the owner said clear
 * them anyway, because the ticker line carries the name from the lookup.
 */
const REVIEWED_NAME_NOTES = new Set([
  "PG - Proctor & Gamble", // misspelled "Procter"; the cache spells it right
  "OV8: Sheng Shiong", // misspelled "Siong"; the cache spells it right
  "ES3 - STI ETF", // the owner's short alias for the Straits Times Index ETF
  "ST Engineering", // abbreviated from Singapore Technologies Engineering Ltd
]);

/** Words that only restate what the derived line says. A note made of nothing
 *  else is cleared. */
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
  "partially",
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
  "shares",
  "share",
  "of",
]);

/** `Avg Down to x10@$263.25` — a share count the Running qty column already
 *  holds and an average the Avg cost column already holds. */
const ACHIEVED_AVERAGE = /\bavg(?:erage)?\s+down\s+to\b/i;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/**
 * Decide what one stored note should become.
 *
 * `date` is the row's own date, used only by the DCA rule: the owner's answer to
 * "which month is each DCA" was the purchase month, so the month is read from
 * the row rather than guessed from the old text.
 */
export function planNoteChange(
  rawInput: string | null | undefined,
  subject: { ticker: string; name?: string | null; date: Date }
): NotePlan {
  const before = (rawInput ?? "").trim();
  if (!before) return { before, after: null, reason: "keep", changed: false };

  // 1. The instrument's name, either provably (the runtime classifier) or by the
  //    owner's row-by-row review of the four it could not verify.
  if (classifyNote(before, { ticker: subject.ticker, name: subject.name }).kind === "reference") {
    return { before, after: null, reason: "reference", changed: true };
  }
  if (REVIEWED_NAME_NOTES.has(before)) {
    return { before, after: null, reason: "reviewed-name", changed: true };
  }

  const body = before.replace(/^\s*[A-Za-z0-9.\-]+\s*[-–—:]\s*/, "").trim() || before;

  // 2. Which board the trade used — kept, with the ordinal dropped. Checked
  //    before the restatement rule, which would otherwise clear these too.
  if (/\bodd\s+lot\b/i.test(body)) {
    return { before, after: "Odd Lot", reason: "odd-lot", changed: "Odd Lot" !== before };
  }

  // 3. A monthly DCA names its allocation month. The amount and the retyped
  //    instrument name are both already on screen.
  if (/\bdca\b/i.test(body)) {
    const after = `DCA · ${formatMonthYear(subject.date)}`;
    return { before, after, reason: "dca-month", changed: after !== before };
  }

  // 4. An average that was actually reached, stated as a share count and a
  //    price, is derived — the owner confirmed `@$263.25` is the outcome.
  if (ACHIEVED_AVERAGE.test(body) && /\bx\d/i.test(body)) {
    return { before, after: null, reason: "achieved-average", changed: true };
  }

  // 5. A restatement of what the row did, plus — in parentheses — the fraction
  //    of the position, which the derived line now states exactly. The digit
  //    check runs on the text OUTSIDE the parentheses, which is what keeps
  //    `100% Stoploss Exit (62.4 SL, 78 TP)` and `1st TP`: an amount or a level
  //    outside parentheses is a plan, and a plan is never cleared.
  const outsideParens = body.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const restated = words(outsideParens);
  if (!/\d/.test(outsideParens) && restated.length > 0 && restated.every((w) => RESTATEMENT_WORDS.has(w))) {
    return { before, after: null, reason: "restates-action", changed: true };
  }

  return { before, after: before, reason: "keep", changed: false };
}
