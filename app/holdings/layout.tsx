"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RegionFlag from "@/components/RegionFlag";

const subLinks = [
  { href: "/holdings/cash", label: "Cash", region: null },
  { href: "/holdings/us", label: "US", region: "US" },
  { href: "/holdings/sg", label: "SG", region: "SG" },
  { href: "/holdings/hk", label: "HK", region: "HK" },
];

export default function HoldingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-ink-300">Holdings</p>
        <ul className="mt-3 flex gap-1 border-b border-ink-700">
          {subLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition ${
                    active
                      ? "border-accent text-ink-100"
                      : "border-transparent text-ink-300 hover:border-ink-500 hover:text-ink-100"
                  }`}
                >
                  {link.region && <RegionFlag region={link.region} />}
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
