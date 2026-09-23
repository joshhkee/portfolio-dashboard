"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, UserRound, X } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/lib/command-search";

/**
 * The five objects the app is organised around.
 *
 * The list used to be eight entries in the order the app was built — Home,
 * Outlay, Transactions, Holdings, Exposure, Attribution, Watchlist, Completed
 * Trades — which made it a list of REPORTS: four of them were views of the same
 * positions and money, competing for top-level slots. Now each entry is a thing
 * the owner has (positions, performance, money, a watchlist, today), and the
 * reports are lenses inside the object they describe:
 *
 *   Positions    US / SG / HK · Exposure lens · the trade ledger
 *   Performance  returns & risk · Attribution lens · realized trades
 *   Money        deposits & schedule · cash & conversions
 *
 * Nothing is unreachable as a result: every lens kept a real URL, `next.config`
 * redirects the old ones, and the command palette indexes all of them.
 */
const links = [
  { href: "/", label: "Today" },
  { href: "/positions", label: "Positions" },
  { href: "/performance", label: "Performance" },
  { href: "/money", label: "Money" },
  { href: "/watchlist", label: "Watchlist" },
];

/**
 * Who the bar should offer the accounts page to.
 *
 * Passed down from the root layout rather than fetched here, because this is a
 * client component and the answer already exists on the server: the layout has
 * resolved the session and knows whether there is a live account (or no
 * accounts at all, the bootstrap case) — a client fetch would only render the
 * same answer late.
 */
export interface NavAccount {
  /** The account signed in right now, or null for the shared password. */
  username: string | null;
  /** Whether to offer the accounts page at all — see guardManageAccounts. */
  canManage: boolean;
}

export default function Nav({ account }: { account: NavAccount }) {
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

  // Below the `lg` breakpoint the links live behind this disclosure.
  //
  // They used to be a single always-visible row, which is what made every page
  // in the app scroll sideways on a phone: the un-wrappable <ul> alone measured
  // ~675px, so the document was ~995px wide on a 390px screen and the whole
  // page could be dragged left and right. Five objects need far less room than
  // eight did, but the breakpoint stays `lg`: the row plus the brand, palette
  // chip and log-out button still wants the width, and a bar that only just
  // fits at `md` is a bar that overflows at `md` on a longer label.
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
              palette nobody uses — so it gets a visible affordance too, and it
              is sized and tinted to be FOUND rather than merely present: a
              filled chip with the word "Search" on it, at the text size of the
              bar around it. The label is the affordance, so it drops out only
              at the narrowest width, where the icon still carries the meaning. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            title={`Search tickers, pages and actions (${isMac ? "⌘K" : "Ctrl+K"})`}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-800/70 px-3 py-1.5 text-sm text-ink-100 transition hover:border-ink-500 hover:bg-ink-800 motion-reduce:transition-none"
          >
            <Search size={15} strokeWidth={1.75} className="text-accent" />
            <span className="hidden sm:inline">Search…</span>
            <span className="hidden text-xs text-ink-500 md:inline">{shortcutLabel}</span>
          </button>

          {/* Accounts is chrome, not one of the five objects, so it sits
              beside the session rather than in the object list. The label is
              the account's name when there is one: "keng" answers "who am I
              signed in as" and accounts are the only thing behind it, which is
              a shorter path than "Accounts" for the question people actually
              have. */}
          {account.canManage && (
            <Link
              href="/accounts"
              title={
                account.username
                  ? `Accounts — signed in as ${account.username}`
                  : "Accounts — no account yet"
              }
              className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition sm:flex motion-reduce:transition-none ${
                isActive("/accounts")
                  ? "border-accent text-ink-100"
                  : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
              }`}
            >
              <UserRound size={13} strokeWidth={1.75} />
              {account.username ?? "Accounts"}
            </Link>
          )}

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
          {/* Accounts and log out are hidden from the bar below `sm`, so they
              have to appear here or they become unreachable on a phone. */}
          {account.canManage && (
            <li className="mt-1 border-t border-ink-700 pt-1">
              <Link
                href="/accounts"
                className={`block rounded-md px-3 py-2.5 text-sm transition sm:hidden motion-reduce:transition-none ${
                  isActive("/accounts")
                    ? "bg-accentMuted text-ink-100"
                    : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                Accounts{account.username ? ` · ${account.username}` : ""}
              </Link>
            </li>
          )}
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
