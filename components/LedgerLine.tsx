import type { LedgerLinePart } from "@/lib/notes";

/**
 * The ledger line a row derives for itself — what this transaction did to the
 * position — followed by the owner's own words, if there are any.
 *
 * It exists as a component rather than a string so that the amount inside it
 * keeps the site's colour rule: a realized gain or loss is coloured, an average
 * cost is not, because a plain value never carries a colour here. The wording,
 * the arrow and that decision all come from `lib/notes.ts`, so there is one
 * implementation of each.
 *
 * The parts arrive already computed rather than as a row to derive from: the
 * line depends on more than the row's arithmetic now (a DCA marker is read from
 * the stored note, and its month may fall back to the row's date), and deciding
 * it twice — once here, once in `noteCell` — is how the cell and its tooltip
 * would come to disagree.
 *
 * The two halves are styled apart on purpose. The derived part is smaller and
 * muted — it is generated, and the difference between what the ledger worked out
 * and what the owner wrote should be visible without reading it. The note is
 * brighter (ink-300 against ink-500) and follows the same line, because it is
 * read as an addition to the facts rather than instead of them. Colour is the
 * only distinction: putting the note on its own line would double the row height
 * for the rows that have one.
 */
export default function LedgerLine({
  parts,
  note = null,
}: {
  parts: LedgerLinePart[];
  /** The owner's note, appended after the derived line. Null appends nothing. */
  note?: string | null;
}) {
  return (
    <span className="text-xs">
      {parts.map((part, i) => (
        <span
          key={i}
          className={part.tone === "gain" ? "text-gain" : part.tone === "loss" ? "text-loss" : undefined}
        >
          {part.text}
        </span>
      ))}
      {note && <span className="text-ink-300"> · {note}</span>}
    </span>
  );
}
