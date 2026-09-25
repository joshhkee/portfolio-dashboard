"use client";

import { Search, X } from "lucide-react";

/**
 * A filter field for the table or panel it sits in.
 *
 * It moved INTO the panel head for a reason that is about the page rather than
 * about the control: as a full-width field on its own row above the table it
 * cost a band of the screen (~40px plus a 16px gap, on every page that has a
 * table) to filter the thing directly beneath it. In the head it is where the
 * question is asked of the answer, and the band it used to occupy belongs to
 * the rows now. It is deliberately SHORT (w-56): a filter is not a search
 * engine, and a field that spans the page reads as the primary action here.
 *
 * The magnifier is decoration on the affordance — the placeholder is the real
 * label, so the icon is `aria-hidden` and the input keeps its own name via
 * `aria-label` from the caller's placeholder. The clear button exists because
 * a filter has no other way back to "everything": tapping it restores the full
 * table without selecting the text and deleting it.
 */
export default function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative flex items-center">
      <Search
        size={13}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute left-2 text-ink-500"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        className="search-compact"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 rounded p-0.5 text-ink-500 transition hover:text-ink-100 motion-reduce:transition-none"
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
