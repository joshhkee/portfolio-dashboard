"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export default function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = "left",
  className = "",
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
}) {
  const Icon = active ? (direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`${alignClass} ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 font-medium transition ${
          active ? "text-ink-100" : "text-ink-300 hover:text-ink-100"
        }`}
      >
        {label}
        <Icon size={12} strokeWidth={2} className="shrink-0" />
      </button>
    </th>
  );
}
