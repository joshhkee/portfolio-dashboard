import { ledgerSummaryParts } from "@/lib/notes";

/**
 * The ledger line a row derives for itself — what this transaction did to the
 * position — shown in the Note column when there is no note to show instead.
 *
 * It exists as a component rather than a string so that the amount inside it
 * keeps the site's colour rule: a realized gain or loss is coloured, an average
 * cost is not, because a plain value never carries a colour here. The wording
 * and that decision both come from `lib/notes.ts`, so there is one
 * implementation of each.
 *
 * Smaller than the surrounding row text on purpose: this is generated, and the
 * distinction between what the ledger worked out and what the owner wrote
 * should be visible without reading it.
 */
export default function LedgerLine({
  row,
  symbol,
}: {
  row: Parameters<typeof ledgerSummaryParts>[0];
  symbol: string;
}) {
  const { parts } = ledgerSummaryParts(row, symbol);
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
    </span>
  );
}
