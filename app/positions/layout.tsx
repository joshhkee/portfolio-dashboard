"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subLinks = [
  { href: "/positions/us", label: "US" },
  { href: "/positions/sg", label: "SG" },
  { href: "/positions/hk", label: "HK" },
];

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label">Open positions</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-fg">Holdings</h1>
        </div>

        <ul className="flex items-stretch gap-6 border-b border-line">
          {subLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href} className="relative">
                <Link
                  href={link.href}
                  className={`block px-1 pb-3 text-sm leading-none transition ${
                    active ? "text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {link.label}
                </Link>
                <span
                  aria-hidden
                  className={`absolute inset-x-0 -bottom-px h-px transition-colors ${
                    active ? "bg-accent" : "bg-transparent"
                  }`}
                />
              </li>
            );
          })}
        </ul>
      </div>
      {children}
    </div>
  );
}
