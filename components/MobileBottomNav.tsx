"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, TrendingUp, Wallet, Eye } from "lucide-react";

/**
 * Mobile-only bottom navigation bar.
 *
 * Sits fixed at the bottom of the viewport below the `lg` breakpoint.
 * Uses safe area padding so home indicators on iOS/Android devices don't
 * obscure the buttons.
 *
 * Keeps desktop (>= lg) strictly untouched.
 */
const TABS = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/positions", label: "Positions", icon: Briefcase },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
];

export default function MobileBottomNav({ canManage: _canManage }: { canManage: boolean }) {
  const pathname = usePathname();

  // Hide on login screen
  if (pathname === "/login") return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-ink-700 bg-ink-900/95 px-1 pb-safe backdrop-blur-md lg:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition motion-reduce:transition-none ${
              active
                ? "font-medium text-accent"
                : "text-ink-500 hover:text-ink-300"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
