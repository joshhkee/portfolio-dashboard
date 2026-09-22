"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/lib/command-search";

const links = [
  { href: "/", label: "Home" },
  { href: "/outlay", label: "Outlay" },
  { href: "/transactions", label: "Transactions" },
  { href: "/holdings", label: "Holdings" },
  { href: "/exposure", label: "Exposure" },
  { href: "/attribution", label: "Attribution" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/completed-trades", label: "Completed Trades" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  // The shortcut label is platform-specific so Windows users aren't told to
  // press ⌘. Starts as the non-Mac label and is corrected after mount:
  // `navigator` doesn't exist during SSR, and defaulting to one label keeps the
  // server HTML and the first client render identical (no hydration mismatch).
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  // Below the `lg` breakpoint the eight links live behind this disclosure.
  //
  // They used to be a single always-visible row, which is what made every page
  // in the app scroll sideways on a phone: the un-wrappable <ul> alone measured
  // ~675px, so the document was ~995px wide on a 390px screen and the whole
  // page could be dragged left and right. The breakpoint is `lg` rather than
  // `md` because the row plus the brand, palette chip and log-out button needs
  // roughly 880px to sit on one line — at `md` it would overflow the 768px
  // viewport it was supposedly designed for.
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on navigation: otherwise tapping a link leaves the panel sitting open
  // on top of the page it just opened.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes it, matching the command palette. Only bound while open so
  // the app isn't carrying a permanent keyboard listener for a hidden panel.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // The login page has nothing to navigate to yet — skip the bar
  // rather than show links that would just bounce back here.
  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <nav className="sticky top-0 z-30 w-full border-b border-ink-700 bg-ink-900">
      <div className="flex h-14 w-full items-center gap-1 px-4 sm:px-6">
        <div className="shrink-0 pr-1">
          <p className="text-sm font-semibold tracking-tight text-ink-100">Investments</p>
        </div>

        <ul className="hidden h-14 items-stretch gap-0.5 lg:flex">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex h-full items-center whitespace-nowrap border-b-2 px-2 text-sm transition xl:px-3 ${
                    active
                      ? "border-accent text-ink-100"
                      : "border-transparent text-ink-300 hover:border-ink-500 hover:text-ink-100"
                  } motion-reduce:transition-none`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="rounded-md border border-ink-700 p-1.5 text-ink-300 transition hover:border-ink-500 hover:text-ink-100 lg:hidden motion-reduce:transition-none"
          >
            {menuOpen ? <X size={16} strokeWidth={1.75} /> : <Menu size={16} strokeWidth={1.75} />}
          </button>

          {/* Keyboard is the fast path, but a palette nobody can discover is a
              palette nobody uses — so it gets a visible affordance too. The
              label is the affordance, so it drops out only at the narrowest
              width, where the icon still carries the meaning. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            title={`Search tickers, pages and actions (${isMac ? "⌘K" : "Ctrl+K"})`}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition hover:border-ink-500 hover:text-ink-100 motion-reduce:transition-none"
          >
            <Search size={13} strokeWidth={1.75} />
            <span className="hidden text-ink-500 sm:inline">{shortcutLabel}</span>
          </button>

          <button
            onClick={handleLogout}
            className="hidden text-sm text-ink-300 hover:text-ink-100 sm:block"
          >
            Log out
          </button>
        </div>
      </div>

      {menuOpen && (
        <ul
          id="nav-menu"
          className="flex flex-col border-t border-ink-700 px-2 py-2 lg:hidden"
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-md px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-accentMuted text-ink-100"
                      : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                  } motion-reduce:transition-none`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          {/* Log out is hidden from the bar below `sm`, so it has to appear
              here or it becomes unreachable on a phone. */}
          <li className="mt-1 border-t border-ink-700 pt-1 sm:hidden">
            <button
              onClick={handleLogout}
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 motion-reduce:transition-none"
            >
              Log out
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
