"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/contributions", label: "Contributions" },
  { href: "/transactions", label: "Transactions" },
  { href: "/positions", label: "Open Positions" },
  { href: "/completed-trades", label: "Completed Trades" },
];

export default function Nav() {
  const pathname = usePathname();

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
    </nav>
  );
}
