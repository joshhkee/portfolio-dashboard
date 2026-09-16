"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export default function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const right = align === "right";
  const Icon = active ? (direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th className={right ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 whitespace-nowrap transition ${
          right ? "justify-end" : ""
        } ${active ? "text-accent" : "text-fg-subtle hover:text-fg-muted"}`}
      >
        {label}
        <Icon size={11} strokeWidth={1.75} aria-hidden />
      </button>
    </th>
  );
}
