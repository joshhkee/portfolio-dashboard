"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/contributions", label: "Contributions" },
  { href: "/transactions", label: "Transactions" },
  { href: "/positions", label: "Open Positions" },
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
    <nav className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-8 px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <span className="font-serif text-base tracking-tight text-fg">Investments</span>
        </Link>

        <ul className="flex h-16 items-stretch gap-6">
          {links.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <li key={link.href} className="relative">
                <Link
                  href={link.href}
                  className={`flex h-16 items-center text-sm leading-none transition ${
                    active ? "text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {link.label}
                </Link>
                <span
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 h-px transition-colors ${
                    active ? "bg-accent" : "bg-transparent"
                  }`}
                />
              </li>
            );
          })}
        </ul>

        <button
          onClick={handleLogout}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-fg-subtle transition hover:bg-surface-raised hover:text-fg"
        >
          <LogOut size={14} strokeWidth={1.5} aria-hidden />
          Log out
        </button>
      </div>
    </nav>
  );
}
