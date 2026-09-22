"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionTab {
  href: string;
  label: string;
  /** Rendered before the label — a region flag or an icon. */
  icon?: React.ReactNode;
}

/**
 * The sub-navigation for a section: one row of tabs under the section's name.
 *
 * Every section uses this instead of hand-rolling its own row, so the tab
 * treatment (and the active rule) is defined once. The sections are the five
 * objects the app is organised around; the tabs inside them are lenses on that
 * object — Positions → Exposure, Performance → Attribution — which is why these
 * are nested routes rather than peers of the section itself.
 *
 * Active is the LONGEST tab href that matches, not the first. Nesting makes the
 * naive `startsWith` rule wrong: at `/performance/attribution`, both
 * `/performance` and `/performance/attribution` are prefixes, and the first
 * would light up the section's own tab while the reader is in a lens.
 */
export default function SectionTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: SectionTab[];
}) {
  const pathname = usePathname();

  const active = tabs.reduce((best, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(tab.href + "/");
    if (!matches) return best;
    if (best === null || tab.href.length > best.href.length) return tab;
    return best;
  }, null as SectionTab | null);

  return (
    <div>
      <p className="text-sm text-ink-300">{label}</p>
      <ul className="mt-3 flex flex-wrap gap-1 border-b border-ink-700">
        {tabs.map((tab) => {
          const isActive = active?.href === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition motion-reduce:transition-none ${
                  isActive
                    ? "border-accent text-ink-100"
                    : "border-transparent text-ink-300 hover:border-ink-500 hover:text-ink-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
