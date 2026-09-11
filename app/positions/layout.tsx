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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-300">Open positions</p>
        <ul className="mt-3 flex gap-1 border-b border-ink-700">
          {subLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`-mb-px block border-b-2 px-4 py-2 text-sm transition ${
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
      </div>
      {children}
    </div>
  );
}
