"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useSlidingPill } from "@/lib/use-sliding-pill";

export interface SectionTab {
  href: string;
  label: string;
  /** Rendered before the label — a region flag or an icon. */
  icon?: React.ReactNode;
}

/**
 * The sub-navigation for a section: one compact strip naming the section and
 * the lenses inside it.
 *
 * Three things changed from the version this replaces, and each was a measured
 * cost rather than a preference:
 *
 * 1. **It is one row instead of two.** The section's name used to be a
 *    `text-sm` paragraph on a line of its own, above a `mt-3` tab row with an
 *    underline per tab — ~90px of chrome to say "Positions" and offer three
 *    links. The name is now a small label INSIDE the row, separated from the
 *    pills by a hairline, so the strip is ~30px. Together with the nav going
 *    from 56px to 48px and the container's padding from 32px to 16px, that is
 *    what moves the page's content budget from 216px of chrome to ~120px.
 *
 * 2. **The pills are a control, not an underline.** Underlined tabs read as a
 *    tabbed document — which is what the app is not. A bordered track with the
 *    active lens filled says "these are views of one thing, pick one" and costs
 *    12px less height at the same text size.
 *
 * 3. **The active lens is the app's gold pill.** This strip was the worst
 *    offender of a drift that made the same gesture look like two controls:
 *    every `SegmentedControl` slid a gold pill while this drew a static
 *    `accentMuted` block, and the slide decks copied the static version. The
 *    strip, the decks and the segmented controls are now the one switch —
 *    `useSlidingPill` for the measurement, `.tab-track`/`.tab-pill`/`.tab-item`
 *    for the look (docs/DESIGN.md §7).
 *
 * The keyboard walks the row. Left/Right (and Home/End) move focus between the
 * lenses; Enter follows the focused one. The links keep their
 * `aria-current="page"`, because that is what these are — real navigation, not
 * a client-side tab panel — and the strip is a `<nav>` labelled with the section
 * name, so the name is available to a screen reader even though it is visually a
 * quiet label rather than a page heading.
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
  const listRef = useRef<HTMLUListElement | null>(null);

  const active = tabs.reduce((best, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(tab.href + "/");
    if (!matches) return best;
    if (best === null || tab.href.length > best.href.length) return tab;
    return best;
  }, null as SectionTab | null);

  const activeIndex = tabs.findIndex((tab) => tab.href === active?.href);
  const { containerRef, itemRef, pill } = useSlidingPill<HTMLUListElement>(activeIndex);

  /**
   * Arrow keys move along the strip, Home/End go to its ends.
   *
   * Focus only — a focused link is not followed until Enter, so arrowing past
   * a lens cannot navigate by accident. Read from the DOM rather than from a
   * roving index: the links are already the only focusable things in the list,
   * and deriving the list from them keeps the handler honest if a tab is added
   * conditionally.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const links = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-tab]") ?? []
    );
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);

    let next: number | null = null;
    if (event.key === "ArrowRight") next = index < 0 ? 0 : (index + 1) % links.length;
    else if (event.key === "ArrowLeft") next = index < 0 ? 0 : (index - 1 + links.length) % links.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = links.length - 1;
    if (next === null) return;

    event.preventDefault();
    links[next].focus();
  }

  return (
    <nav
      aria-label={label}
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      {/* A rule rather than a gap: it says the label names the group that
          follows it, instead of floating beside the first pill. */}
      <span aria-hidden className="h-3.5 w-px bg-ink-700" />
      <ul
        ref={(node) => {
          listRef.current = node;
          containerRef.current = node;
        }}
        onKeyDown={onKeyDown}
        className="tab-track"
      >
        {pill && (
          <span
            aria-hidden
            className="tab-pill"
            style={{
              transform: `translate(${pill.x}px, ${pill.y}px)`,
              width: pill.w,
              height: pill.h,
            }}
          />
        )}
        {tabs.map((tab, i) => {
          const isActive = active?.href === tab.href;
          return (
            <li key={tab.href} ref={itemRef(i)}>
              <Link
                href={tab.href}
                data-tab=""
                aria-current={isActive ? "page" : undefined}
                className={`tab-item flex items-center gap-1.5 text-xs ${
                  isActive
                    ? pill
                      ? "text-ink-950"
                      : "bg-accent text-ink-950"
                    : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
