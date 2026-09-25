"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export default function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = "left",
  className = "",
  title,
  level,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right" | "center";
  /** Extra classes on the <th> — used to drop secondary columns on narrow
   *  screens. Has to live on the header cell itself, since a responsive
   *  utility on some wrapper would have nothing to hide. */
  className?: string;
  /** Hover explanation. Columns get abbreviated to keep a wide table inside its
   *  container, and the abbreviation is where the full name belongs rather
   *  than nowhere. */
  title?: string;
  /**
   * Where this column's sort cycle currently stands — the same `states` index
   * the click advances through, so the two can never disagree.
   *
   * It reads two ways and no third: in the button's accessible name ("Value,
   * level 2 of 4, ascending") and, on hover, in the cell's title. What is NOT
   * here any more is the row of dots that used to draw it.
   *
   * The dots were the one thing on the row that could say "this header cycles
   * through four states and you are two clicks from letting go" — and they were
   * drawn on the ACTIVE header only, so the price was ~12px of sticky header on
   * every table holding eleven columns, plus a second visual language (small
   * round marks) that appears nowhere else in the app. Twelve pixels of header
   * is a table row, and the count is still reachable on hover; the dots went.
   * The label swap ("Value" → "Shares") remains the thing that tells you which
   * figure is in charge.
   */
  level?: { index: number; count: number };
}) {
  const Icon = active ? (direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const levelNote = level
    ? `Sorted by this column at level ${level.index + 1} of ${level.count} — ${
        level.count - level.index - 1
      } more click${level.count - level.index - 1 === 1 ? "" : "s"} hands the order to the other figure.`
    : null;

  return (
    <th
      className={`${alignClass} ${className}`.trim()}
      title={[title, levelNote].filter(Boolean).join(" ") || undefined}
      /* The count is in the accessible name rather than left to a decoration:
         a screen reader gets "Value, level 2 of 4, ascending". `aria-sort`
         states the direction on the column itself, which is what assistive
         tech expects to find there. */
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 font-medium transition ${
          active ? "text-ink-100" : "text-ink-300 hover:text-ink-100"
        }`}
      >
        {label}
        <Icon size={12} strokeWidth={2} className="shrink-0" />
        {level && (
          <span className="sr-only">
            , level {level.index + 1} of {level.count}, {direction === "asc" ? "ascending" : "descending"}
          </span>
        )}
      </button>
    </th>
  );
}
