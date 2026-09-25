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
   * Where this column's sort cycle currently stands, drawn as one dot per
   * state with the current one filled.
   *
   * Only the ACTIVE header is given them, and that is the whole design: a
   * column that is not sorting has no level to be at, so dots on every header
   * would be eleven groups of "level 1" reading as texture — and the chevron
   * plus the label already say what the column would sort by if clicked. What
   * the dots add is the thing nothing else on the row can say: that the cycle
   * has four states, which one you are in, and therefore how many clicks are
   * left before the column lets go of the order.
   */
  level?: { index: number; count: number };
}) {
  const Icon = active ? (direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const dotsClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th
      className={`${alignClass} ${className}`.trim()}
      title={title}
      /* The count is in the accessible name rather than left to the dots, which
         are decorative: a screen reader gets "Value, level 2 of 4, ascending".
         `aria-sort` states the direction on the column itself, which is what
         assistive tech expects to find there. */
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
      {level && (
        <span aria-hidden className={`mt-1.5 flex items-center gap-[3px] ${dotsClass}`}>
          {Array.from({ length: level.count }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === level.index ? "bg-ink-100" : "bg-ink-600"
              }`}
            />
          ))}
        </span>
      )}
    </th>
  );
}
