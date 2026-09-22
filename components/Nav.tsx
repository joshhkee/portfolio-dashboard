"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/lib/command-search";

const links = [
  { href: "/", label: "Home" },
  { href: "/outlay", label: "Outlay" },
  { href: "/transactions", label: "Transactions" },
  { href: "/holdings", label: "Holdings" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/completed-trades", label: "Completed Trades" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  // The login page has nothing to navigate to yet — skip the bar
  // rather than show links that would just bounce back here.
  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-30 flex h-14 w-full items-center gap-6 border-b border-ink-700 bg-ink-900 px-6">
      <div className="py-4 pr-2">
        <p className="text-sm font-semibold tracking-tight text-ink-100">Investments</p>
      </div>
      <ul className="flex h-full items-stretch gap-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex h-full items-center border-b-2 px-3 py-4 text-sm transition ${
                  active
                    ? "border-accent text-ink-100"
                    : "border-transparent text-ink-300 hover:border-ink-500 hover:text-ink-100"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Keyboard is the fast path, but a palette nobody can discover is a
          palette nobody uses — so it gets a visible affordance too. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        title="Search tickers, pages and actions (Cmd/Ctrl+K)"
        aria-label="Open command palette"
        className="ml-auto flex items-center gap-2 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition hover:border-ink-500 hover:text-ink-100 motion-reduce:transition-none"
      >
        <Search size={13} strokeWidth={1.75} />
        <span className="text-ink-500">⌘K</span>
      </button>
      <button
        onClick={handleLogout}
        className="text-sm text-ink-300 hover:text-ink-100"
      >
        Log out
      </button>
    </nav>
  );
}
