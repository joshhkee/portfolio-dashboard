// The `notes` column, and what to do about it.
//
// Measured on the live ledger (2026-09-23, 64 rows): 60 of the 64 notes are the
// instrument's NAME, typed two different ways — `VOO - Vanguard S&P 500 ETF`,
// but also `PLTR: Palantir` — and the rest are human shorthand for the trade or
// a plan level (`B - Second Buy`, `DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)`).
//
// So the column was doing two jobs, and only one of them is a note:
//
//   1. REFERENCE DATA — the instrument's name. Part 2 made that redundant:
//      `TickerMeta` caches the name per (region, ticker) and the UI renders it
//      under the ticker, so a note that is the name is duplication that can
//      drift from the cache (and did: one row misspells a company).
//   2. HUMAN CONTEXT — what the owner was thinking. This is the part worth
//      keeping, and the part this redesign has to protect.
//
// This module owns both answers and writes nothing:
//
//   - `ledgerSummary()` renders what the ledger can DERIVE — what this row did
//     to the position — so a factual note never has to be typed at all. It is
//     computed on every render and never stored (architecture invariant 1).
//   - `classifyNote()` decides whether a STORED note is reference data or
//     context, so the UI can stop showing the name twice. Hiding a note is a
//     DISPLAY decision: the stored text is read back verbatim by the edit form
//     and is not rewritten until the owner approves a cleanup, which is why
//     `scripts/notes-dry-run.ts` prints the before/after first.
//
// The bias is asymmetric on purpose. Showing a name that did not need showing
// is noise; hiding something a person wrote is data loss. So a note is hidden
// only when the classifier can prove every meaningful word in it already
// appears in the instrument's name — an unrecognised, misspelled or
// abbreviated note stays on screen (see `isNameOnly`).

import { formatAmount, formatQty } from "@/lib/format";

const EPSILON = 1e-6;

/** Words that never distinguish one instrument from another, so they are
 *  dropped before a note and a name are compared. `etf`/`fund`/`trust`/`index`
 *  are here because the lookup reports them inconsistently (`… ETF Shares` vs
 *  `… ETF`), and `holdings`/`group`/`ltd` for the same reason in the other
 *  direction. */
const NAME_NOISE = new Set([
  "the",
  "and",
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "plc",
  "group",
  "holdings",
  "holding",
  "ag",
  "sa",
  "nv",
  "trust",
  "etf",
  "fund",
  "funds",
  "index",
  "shares",
  "share",
]);

/** Lowercase, punctuation-free meaningful words, lightly pluralised so
 *  `holdings`/`holding` and `networks`/`network` compare equal. */
export function nameTokens(input: string): Set<string> {
  const tokens = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((t) => !NAME_NOISE.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  return new Set(tokens);
}

/** Jaccard overlap of two names' meaningful words. Used by the dry-run
 *  analysis to flag notes that look like a name variant we could not verify;
 *  the display decision itself uses `isNameOnly`, which is stricter. */
export function looksLikeSameName(a: string, b: string): boolean {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared) >= 0.5;
}

/**
 * Is this text nothing but the instrument's name?
 *
 * True when every meaningful word in `text` also appears in the resolved
 * `name`, and at least one word is shared. Anything the name does not already
 * say makes it false, which is what keeps a person's words visible:
 *
 *   `Vanguard S&P 500 ETF` vs `Vanguard S&P 500 ETF`  -> true  (the name)
 *   `Palantir`             vs `Palantir Technologies Inc.` -> true
 *   `Vanguard Growth ETF`  vs `Vanguard Morningstar Growth ETF` -> true
 *   `Sheng Shiong`         vs `Sheng Siong Group Ltd` -> false (misspelled)
 *   `Proctor & Gamble`     vs `The Procter & Gamble Company` -> false
 *   `ST Engineering`       vs `Singapore Technologies Engineering Ltd` -> false
 *   `… ETF (MAY DCA: $865)`-> false (says something extra)
 *
 * One-character leftovers are tolerated (`XIAOMI-W` against `Xiaomi
 * Corporation` is still a name — Hong Kong appends a voting-rights letter),
 * but a text made ONLY of such leftovers is not.
 */
export function isNameOnly(text: string, name: string | null | undefined): boolean {
  const resolved = name?.trim();
  if (!resolved) return false;
  const nameWords = nameTokens(resolved);
  if (nameWords.size === 0) return false;
  const words = nameTokens(text);
  if (words.size === 0) return false;
  let shared = 0;
  for (const word of words) {
    if (nameWords.has(word)) {
      shared++;
      continue;
    }
    if (word.length > 1) return false;
  }
  return shared > 0;
}

/** Is this the ledger's own ticker? Leading zeros are ignored, because the
 *  ledger stores `03115` and a note may write `3115`. */
function isTicker(text: string, ticker: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/^0+(?=\d)/, "");
  return norm(text) === norm(ticker);
}

/**
 * Drop a leading `TICKER - ` / `TICKER: ` prefix, returning what follows.
 * Returns null when the note does not start with this row's ticker.
 *
 * Only a separator ATTACHED to the ticker counts, and the remainder is taken
 * verbatim rather than re-joined, so a note like
 * `03115 - iShares Core Hang Seng Index ETF` or
 * `VT - Vanguard Total World Stock ETF (MAY DCA: $865)` keeps its inner
 * punctuation exactly as typed.
 */
export function noteBodyAfterTicker(note: string, ticker: string): string | null {
  const match = note.match(/^\s*([A-Za-z0-9.\-]+)\s*[-–—:]\s*/);
  if (!match || !isTicker(match[1], ticker)) return null;
  return note.slice(match[0].length).trim();
}

export type NoteKind = "empty" | "reference" | "context";

export interface NoteClassification {
  kind: NoteKind;
  /** What should be SHOWN as this row's note. null when there is nothing to
   *  show, which is a real and deliberate state rather than a blank cell. */
  note: string | null;
  /** The stored text, verbatim — for the edit form and for the cell's hover. */
  raw: string;
}

/**
 * Decide whether a stored note is the instrument's name or a person's words.
 *
 * `reference` means: this note is the instrument's name, the UI already shows
 * that name under the ticker, so it is not shown twice. `context` means: a
 * person wrote this and it stays on screen exactly as typed. Anything that
 * cannot be verified against the cached name is `context`.
 */
export function classifyNote(
  rawInput: string | null | undefined,
  subject: { ticker: string; name?: string | null }
): NoteClassification {
  const raw = (rawInput ?? "").trim();
  if (!raw) return { kind: "empty", note: null, raw: "" };

  const name = subject.name?.trim() || null;
  const rest = noteBodyAfterTicker(raw, subject.ticker);

  // No ticker prefix: the whole note has to be the name for it to be hidden,
  // and that needs a resolved name to check against.
  if (rest === null) {
    return isNameOnly(raw, name)
      ? { kind: "reference", note: null, raw }
      : { kind: "context", note: raw, raw };
  }

  if (!rest) return { kind: "reference", note: null, raw };
  return isNameOnly(rest, name)
    ? { kind: "reference", note: null, raw }
    : { kind: "context", note: raw, raw };
}

/** What a ledger row did to its position — the factual line the ledger renders
 *  instead of a hand-typed note. Derived every render, never stored. */
export function ledgerSummary(
  row: {
    action: string;
    qty: number;
    price: number;
    qtyBefore: number;
    avgCostBefore: number;
    runningQty: number;
    runningAvgCost: number;
  },
  symbol: string
): string {
  const money = (v: number) => `${symbol}${formatAmount(Math.abs(v))}`;
  const signed = (v: number) => `${v < 0 ? "-" : "+"}${money(v)}`;
  const qty = formatQty(row.qty);

  if (row.action === "Buy") {
    const opening = row.qtyBefore <= EPSILON;
    return opening
      ? `Opened · ${qty} @ ${money(row.price)}`
      : `Added ${qty} @ ${money(row.price)} · avg ${money(
          row.avgCostBefore
        )} → ${money(row.runningAvgCost)}`;
  }

  const realized =
    row.avgCostBefore > EPSILON ? ` · ${signed((row.price - row.avgCostBefore) * row.qty)}` : "";
  const closing = row.runningQty <= EPSILON;
  return closing
    ? `Closed · sold ${qty} @ ${money(row.price)}${realized}`
    : `Sold ${qty} @ ${money(row.price)}${realized} · ${formatQty(row.runningQty)} left`;
}
