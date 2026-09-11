"use client";

export default function SortableTh({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 font-medium transition ${
          active ? "text-ink-100" : "text-ink-300 hover:text-ink-100"
        }`}
      >
        {label}
        <span className="text-[10px] leading-none">
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
