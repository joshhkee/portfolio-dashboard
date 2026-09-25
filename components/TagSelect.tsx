"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface TagSelectProps {
  value: string;
  /** The choices to offer, in display order. */
  options: string[];
  onChange: (next: string) => void;
  /** Enter, or picking an option. Receives the value being committed. */
  onCommit: (next: string) => void;
  /** Escape. Reverts rather than clears — see the row in SectorTagEditor. */
  onEscape?: () => void;
  /** Focus loss. The row uses this to settle itself: a tag box that is meant
   *  to be set once should not be left sitting open with an unsaved draft. */
  onBlur?: () => void;
  /** Focus the input on mount — for a row that opened its editor on click. */
  autoFocus?: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** Disabled while a save is in flight. */
  busy?: boolean;

  /** Longest option list rendered in the popup before it scrolls. */
  maxVisible?: number;
}

/**
 * A tag field that is both a text box and a dropdown.
 *
 * Both halves matter and neither replaces the other. The dropdown is the
 * vocabulary: it offers every tag in lib/sectors.ts, so a tag can be picked
 * rather than spelled, and two rows tagged through it can never disagree by a
 * case or a plural. The text box stays because the vocabulary is not a cage —
 * an instrument that genuinely needs a new tag can still be given one, and
 * legacy free-text tags keep rendering and re-saving.
 *
 * Keyboard behaviour is the part worth stating, because a combobox that steals
 * the arrow keys silently breaks typing in the middle of a word:
 *   ↑/↓   move within the popup (only while it is open; the caret never moves)
 *   Enter commit what is highlighted, or the typed text when nothing is
 *   Escape close the popup, or hand the row back to its saved tag
 */
export default function TagSelect({
  value,
  options,
  onChange,
  onCommit,
  onEscape,
  onBlur,
  autoFocus = false,
  placeholder,
  ariaLabel,
  busy = false,
  maxVisible = 8,
}: TagSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Which way the popup opens. See the effect below for why this is not a
  // constant.
  const [openUp, setOpenUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const query = value.trim().toLowerCase();
  const matches = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;

  // Close on an outside click. Mousedown rather than click so the list closes
  // before a click lands on the page behind it.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /**
   * Decide which way the popup opens, once, when it opens.
   *
   * Always downward was fine while this control sat in a list that grew the page.
   * In a bounded, scrolling list — the exposure page's tag panel from `xl`, where
   * the rows scroll inside a fixed-height panel — a dropdown that only opens
   * downward gets CUT OFF for the last rows, because the popup is a child of its
   * row and a scroll container clips whatever hangs out of it.
   *
   * So: open down when there is a popup's worth of room below, otherwise up.
   * `160px` is a little more than the tallest popup (five options is 148px), so
   * the flip happens before clipping rather than after. The room is measured
   * against the nearest scroll container when there is one and the window when
   * there is not, which also fixes the same problem at the bottom of a phone
   * screen.
   */
  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>("[data-tag-scroll]");
    const bounds = scroller?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const roomBelow = (bounds?.bottom ?? window.innerHeight) - rect.bottom;
    const roomAbove = rect.top - (bounds?.top ?? 0);
    setOpenUp(roomBelow < 160 && roomAbove > roomBelow);
  }, [open]);

  function commit(next: string) {
    setOpen(false);
    setActive(-1);
    onCommit(next);
  }

  return (
    <div ref={wrapRef} className="relative min-w-0 flex-1">
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              // Only intercept while the popup is showing options to move
              // through; otherwise the caret keeps the key.
              if (!open) setOpen(true);
              e.preventDefault();
              const count = matches.length;
              if (count === 0) return;
              setActive((prev) => {
                const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
                if (next < 0) return count - 1;
                if (next >= count) return 0;
                return next;
              });
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              commit(active >= 0 ? matches[active] ?? value : value);
              return;
            }
            if (e.key === "Escape") {
              if (open) {
                setOpen(false);
                setActive(-1);
              } else {
                onEscape?.();
              }
              return;
            }
            if (e.key === "Tab") {
              setOpen(false);
              setActive(-1);
            }
          }}
          disabled={busy}
          autoFocus={autoFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          role="combobox"
          className="field min-w-0 px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show all tags for ${ariaLabel}`}
          // Never takes focus: the input has to keep it, or clicking this to
          // open the list would blur the field and settle the row before the
          // list was ever usable.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          className="shrink-0 rounded border border-ink-700 px-1.5 py-1 text-[10px] text-ink-500 transition hover:border-ink-500 hover:text-ink-100 motion-reduce:transition-none"
        >
          ▾
        </button>
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 z-30 max-h-56 overflow-y-auto rounded-md border border-ink-600 bg-ink-850 p-1 shadow-xl ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{ maxHeight: `${Math.min(matches.length, maxVisible) * 1.75 + 0.5}rem` }}
        >
          {matches.map((option, i) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  // mousedown, not click: the input must not blur first, or the
                  // outside-click handler closes the list before this fires.
                  e.preventDefault();
                  commit(option);
                }}
                className={`block w-full rounded px-2 py-1 text-left text-xs transition motion-reduce:transition-none ${
                  i === active ? "bg-ink-800 text-ink-100" : "text-ink-300"
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
