"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, UserRound, LogOut } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/lib/command-search";

/**
 * The five objects the app is organised around.
 *
 * Desktop navigation sits in the top bar. Below `lg`, primary navigation
 * is handled by MobileBottomNav, leaving this top bar as a clean, lean
 * header that exposes the current section, command search, and the account chip.
 */
const links = [
  { href: "/", label: "Today" },
  { href: "/positions", label: "Positions" },
  { href: "/performance", label: "Performance" },
  { href: "/money", label: "Money" },
  { href: "/watchlist", label: "Watchlist" },
];

export interface NavAccount {
  username: string | null;
  canManage: boolean;
}

export default function Nav({ account }: { account: NavAccount }) {
  const pathname = usePathname();
  const router = useRouter();

  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  // Derive current section label for mobile header
  const currentObject = links.find((l) => isActive(l.href))?.label ?? (pathname?.startsWith("/accounts") ? "Accounts" : "Investments");

  return (
    <nav className="sticky top-0 z-30 w-full border-b border-ink-700 bg-ink-900">
      <div className="flex h-12 w-full items-center justify-between gap-2 px-4 sm:px-6">
        {/* Desktop links (>= lg) */}
        <ul className="hidden h-12 items-stretch gap-0.5 lg:flex">
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

        {/* Mobile current section indicator (< lg) */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-sm font-medium text-ink-100">{currentObject}</span>
        </div>

        {/* Right side controls: Search, Account, Logout */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Command search trigger: icon on mobile, search bar on desktop */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            title={`Search tickers, pages and actions (${isMac ? "⌘K" : "Ctrl+K"})`}
            aria-label="Open command palette"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md border border-ink-600 bg-ink-800/70 p-2 text-sm text-ink-100 transition hover:border-ink-500 hover:bg-ink-800 sm:min-h-0 sm:min-w-0 sm:w-56 sm:px-2.5 sm:py-1 md:w-72 xl:w-96 motion-reduce:transition-none"
          >
            <Search size={16} strokeWidth={1.75} className="shrink-0 text-accent sm:size-[15px]" />
            <span className="hidden sm:inline">Search…</span>
            <span className="ml-auto hidden shrink-0 text-xs text-ink-500 md:inline">
              {shortcutLabel}
            </span>
          </button>

          {/* Account chip: accessible on mobile as well as desktop */}
          {account.canManage && (
            <Link
              href="/accounts"
              title={
                account.username
                  ? `Accounts — signed in as ${account.username}`
                  : "Accounts — no account yet"
              }
              aria-label="Accounts"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md border p-2 text-xs transition sm:min-h-0 sm:min-w-0 sm:px-2.5 sm:py-1 motion-reduce:transition-none ${
                isActive("/accounts")
                  ? "border-accent text-ink-100"
                  : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
              }`}
            >
              <UserRound size={15} strokeWidth={1.75} className="sm:size-[13px]" />
              <span className="hidden sm:inline">{account.username ?? "Accounts"}</span>
            </Link>
          )}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-transparent p-2 text-ink-300 transition hover:border-ink-700 hover:text-ink-100 sm:min-h-0 sm:min-w-0 sm:border-0 sm:p-0 sm:text-sm"
          >
            <LogOut size={16} strokeWidth={1.75} className="sm:hidden" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
