"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  COMMAND_LIMIT,
  filterCommands,
  OPEN_PALETTE_EVENT,
  type Command,
} from "@/lib/command-search";

const ACTIONS: Command[] = [
  {
    id: "action-log-transaction",
    label: "Log a transaction",
    group: "Actions",
    href: "/positions/transactions?add=1",
    keywords: "buy sell add new trade transaction",
  },
  {
    id: "action-record-deposit",
    label: "Record a deposit",
    group: "Actions",
    href: "/money?add=1",
    keywords: "contribution outlay add money deposit",
  },
];

/**
 * Every page, including the lenses.
 *
 * The palette is where the old top-level report names now live: someone who
 * types "exposure" or "attribution" out of habit still lands on the right
 * view, it just isn't drawing a permanent nav slot away from the object it
 * belongs to. Each entry's keywords carry the words a person actually types.
 */
const PAGES: Command[] = [
  { id: "page-today", label: "Today", group: "Go to", href: "/", keywords: "home overview dashboard" },
  { id: "page-positions", label: "Positions", group: "Go to", href: "/positions/us", keywords: "holdings open us" },
  { id: "page-positions-sg", label: "Positions · SG", group: "Go to", href: "/positions/sg", keywords: "holdings singapore" },
  { id: "page-positions-hk", label: "Positions · HK", group: "Go to", href: "/positions/hk", keywords: "holdings hong kong" },
  { id: "page-transactions", label: "Transaction ledger", group: "Go to", href: "/positions/transactions", keywords: "transactions entries buy sell trades" },
  { id: "page-performance", label: "Performance", group: "Go to", href: "/performance", keywords: "returns risk sharpe volatility drawdown benchmark" },
  { id: "page-realized", label: "Realized trades", group: "Go to", href: "/performance/realized", keywords: "completed sold closed profit" },
  { id: "page-money", label: "Money", group: "Go to", href: "/money", keywords: "outlay contributions deposits stakeholders schedule" },
  { id: "page-cash", label: "Cash", group: "Go to", href: "/money/cash", keywords: "balances currency exchange conversions" },
  { id: "page-watchlist", label: "Watchlist", group: "Go to", href: "/watchlist", keywords: "watching ideas" },
  // Chrome rather than an object, so it is not in the nav's object list — but it
  // is a page, and someone who wants to add a person should be able to type
  // "user" rather than hunt for it. It explains itself if the visitor may not
  // manage accounts (see app/accounts/page.tsx).
  { id: "page-accounts", label: "Accounts", group: "Go to", href: "/accounts", keywords: "users people identities add user sign in password stakeholders" },
  { id: "page-exposure", label: "Exposure", group: "Lens", href: "/positions/exposure", keywords: "sector currency fx concentration what am i in" },
  { id: "page-attribution", label: "Attribution", group: "Lens", href: "/performance/attribution", keywords: "contribution which holding drove returns monthly quarterly" },
];

interface PaletteTicker {
  region: string;
  ticker: string;
  name: string | null;
}

/**
 * Cmd/Ctrl+K palette: jump to a page, jump to an instrument, or start logging.
 *
 * The ticker list is fetched once on first open and cached in state, and the
 * endpoint behind it is DB-only (see app/api/palette/route.ts) — so opening
 * the palette costs no Yahoo requests and typing costs no requests at all.
 *
 * Keyboard handling lives on `window` rather than the input so Escape and the
 * arrows work even if focus drifts, and the shortcut is registered globally so
 * it works from any page. Arrow movement is clamped rather than wrapping: with
 * a filtered list, wrapping from the last row to the first is more often a
 * mis-press than an intent.
 */
export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [tickers, setTickers] = useState<PaletteTicker[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The login page has nothing to navigate to yet.
  const hidden = pathname === "/login";

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    if (hidden) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    };
  }, [hidden]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || tickers !== null) return;
    let cancelled = false;
    fetch("/api/palette")
      .then((res) => (res.ok ? res.json() : { tickers: [] }))
      .then((data) => {
        if (!cancelled) setTickers(Array.isArray(data.tickers) ? data.tickers : []);
      })
      .catch(() => {
        if (!cancelled) setTickers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tickers]);

  const commands = useMemo<Command[]>(() => {
    const tickerCommands: Command[] = (tickers ?? []).map((t) => ({
      id: `ticker-${t.region}-${t.ticker}`,
      label: `${t.region} ${t.ticker}`,
      group: "Holdings",
      // The region page highlights and scrolls to this ticker on arrival.
      href: `/positions/${t.region.toLowerCase()}?ticker=${encodeURIComponent(t.ticker)}`,
      hint: t.name ?? undefined,
      keywords: `${t.ticker} ${t.region} ${t.name ?? ""}`.toLowerCase(),
    }));
    return [...ACTIONS, ...PAGES, ...tickerCommands];
  }, [tickers]);

  const results = useMemo(
    () => filterCommands(commands, query, COMMAND_LIMIT),
    [commands, query]
  );

  /**
   * The same results, arranged under their group headings.
   *
   * Each entry keeps its index in the FLAT filtered list, because that is what
   * the keyboard walks — grouping is a rendering concern and must not renumber
   * the arrows. Groups appear in the order their first result did, so a query
   * that only matches holdings leads with holdings.
   */
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, { command: Command; index: number }[]>();
    results.forEach((command, index) => {
      if (!byGroup.has(command.group)) {
        byGroup.set(command.group, []);
        order.push(command.group);
      }
      byGroup.get(command.group)!.push({ command, index });
    });
    return order.map((group) => ({ group, items: byGroup.get(group)! }));
  }, [results]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const choice = results[active];
        if (choice) {
          event.preventDefault();
          close();
          router.push(choice.href);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, results, active, close, router]);

  // Keep the highlighted row visible when arrowing past the fold. "nearest"
  // scrolls only when needed and never animates, so there is no motion to
  // suppress for prefers-reduced-motion. Addressed by data-index rather than
  // by child position, because the list is now grouped and a child of the
  // listbox is a group rather than a row.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function run(command: Command) {
    close();
    router.push(command.href);
  }

  if (hidden) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-[2px]"
          onClick={close}
          role="presentation"
        >
          {/* Sized and lit to read as the primary control it is: wider than a
              dialog needs to be for text, a taller input, and a heavier shadow
              so it sits ON the page rather than in it. The gold top edge it
              used to carry was removed — at a glance it read as a warning
              stripe rather than as emphasis. `swap-in` is the app's one
              entrance motion, under prefers-reduced-motion it simply appears. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
            className="swap-in w-full max-w-2xl overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-4">
              <Search size={18} className="shrink-0 text-accent" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Jump to a ticker, page or action…"
                aria-label="Search commands"
                aria-controls="command-results"
                aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
                role="combobox"
                aria-expanded="true"
                className="w-full bg-transparent text-base text-ink-100 outline-none placeholder:text-ink-500"
              />
            </div>

            <div
              id="command-results"
              ref={listRef}
              role="listbox"
              aria-label="Commands"
              className="max-h-[26rem] overflow-auto py-1.5"
            >
              {results.length === 0 && (
                <p className="px-5 py-3 text-sm text-ink-300">
                  Nothing matches &ldquo;{query}&rdquo;.
                </p>
              )}
              {groups.map(({ group, items }) => (
                <div key={group} role="group" aria-label={group}>
                  <p className="px-5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                    {group}
                  </p>
                  <ul role="presentation">
                    {items.map(({ command, index }) => (
                      <li
                        key={command.id}
                        id={`cmd-${command.id}`}
                        role="option"
                        aria-selected={index === active}
                      >
                        {/* The active row is marked by a gold rail as well as
                            its background, so the eye finds it without
                            depending on a subtle shift of grey. */}
                        <button
                          type="button"
                          data-index={index}
                          onClick={() => run(command)}
                          onMouseEnter={() => setActive(index)}
                          className={`flex w-full items-center justify-between gap-4 border-l-2 px-5 py-2 text-left text-sm transition-colors motion-reduce:transition-none ${
                            index === active
                              ? "border-l-accent bg-accent/10 text-ink-100"
                              : "border-l-transparent text-ink-300"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{command.label}</span>
                            {command.hint && (
                              <span className="block truncate text-xs text-ink-500">
                                {command.hint}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-ink-700 px-5 py-2.5 text-xs text-ink-500">
              <span>&uarr;&darr; to move &middot; &crarr; to open</span>
              <span>esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
