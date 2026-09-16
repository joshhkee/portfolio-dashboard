---
name: redesign-brief
description: "Describe when and why an agent should use this skill."
---
# Portfolio Dashboard Redesign Brief

## Vibe
Dark, minimalist, quiet-luxury finance app. Think a private banking terminal, not a crypto trading app — restrained, not flashy. Calm surface, precise data.

## Color Palette (Tailwind config values)

**Base (grey-dark theme, not pure black)**
- `bg-primary`: `#121212` (page background)
- `bg-surface`: `#1a1a1a` (cards, panels)
- `bg-surface-raised`: `#212121` (modals, hover states, table header row)
- `border`: `#2e2e2e` (hairline dividers, card borders — keep subtle, not high contrast)

**Text (never pure white/black)**
- `text-primary`: `#e8e6e1` (warm off-white, main numbers/headings)
- `text-secondary`: `#a3a099` (labels, muted captions)
- `text-tertiary`: `#6b6862` (timestamps, disabled states)

**Yellow accent (sparingly — CTAs, active states, highlights, key totals)**
- `accent`: `#d4a94a` (muted gold, not neon yellow)
- `accent-hover`: `#e0bb63`
- `accent-muted`: `#3a331f` (background wash for accent badges/pills)

**Gains/Losses (desaturated — avoid stock-app neon green/red)**
- `positive`: `#7fa87a` (sage/muted green)
- `positive-bg`: `#1c2620` (subtle wash for positive cells/badges)
- `negative`: `#b06d64` (muted terracotta/brick red, not fire-engine red)
- `negative-bg`: `#2a1e1c` (subtle wash for negative cells/badges)
- `neutral`: `#a3a099` (flat/zero change — reuse text-secondary)

## Typography
- **Base font**: serif — but consider **Georgia** or **Source Serif 4** over literal Times New Roman for better screen legibility at small sizes; Times New Roman can look dated/cramped in UI contexts. Worth trying both and comparing.
- **Numbers/data (tables, prices, %, totals)**: monospace — e.g. `JetBrains Mono`, `IBM Plex Mono`, or `Space Mono`. Tabular figures so columns align.
- **Headings**: same serif family, slightly heavier weight or letter-spacing for hierarchy rather than switching typefaces.
- Avoid bold-heavy UI — let color and spacing (not weight) carry most of the hierarchy.

## Table Design
- Header row background: a step between `bg-surface` and `bg-surface-raised` (e.g. `#1d1d1d`) — distinct enough to scan, not a hard block of contrast.
- Header text: `text-secondary`, small caps or letter-spaced uppercase, smaller font size than body rows.
- Row dividers: hairline `border` color only — no zebra striping (keeps it clean/minimalist).
- Row hover: very subtle lighten (`bg-surface-raised` at low opacity), not a color highlight.
- Numeric columns right-aligned, monospace, tabular-nums.

## General Guidelines
- Generous whitespace/padding over dense grids — minimalist means restraint, not cramming more data in.
- Accent yellow used deliberately: primary CTA button, active nav item, maybe portfolio total/net worth figure. Not on every icon or link.
- Icons (if any): thin/outline style, not filled, matching the restrained aesthetic.
- Charts: line/area charts in muted accent + positive/negative colors, no gridlines or very faint ones, no drop shadows.
- Border radius: small-medium (6–10px), not fully rounded — keeps it feeling precise/financial rather than playful.
- No heavy box-shadows; rely on subtle border + background-layer contrast for elevation.
- Consistent 4px/8px spacing scale throughout.

## Open Questions (for Claude to ask before implementing, or for Josh to answer here)
- Any reference sites/apps whose aesthetic is close to what you want (e.g. Linear, Mercury, Arc, a specific bank app)?
- Answer: monkeytpe, phantom adjacent vibe
- Preference between literal Times New Roman vs. a more screen-friendly serif?
- Answer: a more screen-friendly serif is great
- Should the yellow accent appear in charts at all, or stay confined to UI chrome (buttons/nav/highlights)?
- Answer: for now, let the pastel yellow accent stay in the ui only
- Any icon library preference, or default to Tailwind-friendly options like Lucide/Heroicons (outline variants)?
- Answer: tailwind-friendly options are good

## Task
Using the above as flexible guidelines (not strict rules), redesign the existing Tailwind-based portfolio dashboard site. Propose specific Tailwind config values (colors, fonts, spacing) matching this direction, then apply them across all pages/components (Portfolio, Transaction Ledger, Open Positions, Completed Trades). Flag any place where the guidelines conflict with readability or existing functionality, and suggest a fix.
