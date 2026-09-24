# Design system

The rules behind how this dashboard looks, reads and behaves — and the reason for
each, which is usually a measurement. `docs/PLAN.md` holds the history of how they
were arrived at; this file is what still holds.

If you are changing something visible, two rules in here are not negotiable:
**colour means up or down** (§2) and **stored text never replaces derived facts**
(§8).

---

## 1. The feel

A warm dark "private banking terminal": restrained, quiet, precise data. Not a
crypto trading app — no neon, no glow, no gamified motion. `#121212`, not pure
black; warm off-white text, never pure white; muted gold as the single interactive
accent; gains and losses desaturated on purpose.

The base surface is a page (`ink-950`), panels on it (`ink-900`), one step up for
table headers (`ink-850`) and modals (`ink-800`), hairline borders (`ink-700`).
The whole palette is a values-only change under the existing names — every
`ink-*` / `gain` / `loss` / `accent` class repaints automatically, so never add a
second name for a colour that already exists.

---

## 2. Colour

### Tokens

| token | value | role | measured contrast |
|---|---|---|---|
| `ink-950` | `#121212` | page | — |
| `ink-900` | `#1a1a1a` | panels, cards, nav | — |
| `ink-850` | `#1d1d1d` | table header row | — |
| `ink-800` | `#212121` | modals, hover | — |
| `ink-700` | `#2e2e2e` | hairline borders | — |
| `ink-600` | `#3a3a3a` | stronger border (totals, emphasis) | — |
| `ink-500` | `#8f8b85` | timestamps, hints, disabled, placeholder `—` | 5.53 page · 5.14 panel · **4.75 modal** (worst case) |
| `ink-300` | `#a3a099` | labels, captions, muted body | ≥ 7:1 |
| `ink-100` | `#e8e6e1` | primary text and headings | — |
| `gain` / `gainBg` | `#7fa87a` / `#1c2620` | gains, and the wash behind a gain badge | ≥ 5:1 |
| `loss` / `lossBg` | `#c07f74` / `#2a1e1c` | losses | ≥ 5:1 everywhere, including the badge background |
| `accent` | `#d4a94a` | brand and interaction: active nav, focus, primary CTA, the single-series chart line | 8.54 page · 7.93 panel · 6.19 against gridlines |
| `accentHover` / `accentMuted` | `#e0bb63` / `#3a331f` | hover, and the badge/pill wash | — |

The `data.*` palette is only for charts with more than one series: `steel #7d97b3`,
`sage #7fa87a`, `terracotta #c07f74`, `gold #c9a86a`, `mauve #9b8ab8`,
`teal #6fa8a3` — every one measured ≥ 5.7:1 on the page background. `data-gold` is
deliberately the desaturated cousin of the chrome gold: `accent` stays the
interactive colour and the portfolio line.

Two earlier values were changed because they failed AA, and the *worst case*
background decided each one, not the page: `ink-500` was `#6b6862` (3.04–3.37:1)
and is now chosen to clear 4.5:1 on modal `ink-800`; `loss` was `#b06d64` (4.32:1
on panels) and is now ≥ 5:1 on its own badge wash. Change either of these and
re-measure against the darkest background it lands on.

### The colour rule

**Colour means direction. A value that is simply a value is neutral, however
large or positive it is.**

- Coloured by sign: `Money`, `NativeMoney`, `Percent` — gains, losses, returns,
  percentages, P/L, XIRR, attribution cells and their contributor rankings (those
  figures are position gains, even though the panel is a ranking).
- Never coloured: `PlainMoney`, `PlainPercent`, `formatAmount` — the portfolio
  total, a holding's value, total outlay, contributed-versus-current-value
  columns, cost basis, prices, average cost.

The rule has been violated in five places and fixed (the Today hero total, the
largest-positions values, `/money`'s total outlay, the stakeholder table's
Contributed and Current-value columns, and `/performance`'s "Holdings value"
stat). When in doubt: is this figure a *result* or a *quantity*? Results are
coloured.

### Two colours that are choices, not accidents

- The proportion bars — the holding-value and outlay stakeholder bars — are
  **gold** (`bg-accent/70`), not a `data.*` colour. That was corrected once and
  then reversed by the owner, who preferred gold. Do not "fix" it again; gold on
  the `ink-800` track measures ~7.5:1, so there is no accessibility argument
  either.
- The value chart's dashed outlay reference line is `#5f5c57`: at `ink-500` it
  separated from the gold series by only 2.53:1 (below the 3:1 non-text floor),
  and this value gives 3.03:1 while still receding 2.81:1 against the page.

Signs and labels carry meaning alongside colour, always — a gain reads `+S$420`,
never merely green, so the figures survive a colour-blind reader and a
monochrome screenshot.

---

## 3. Typography

- **Base font is serif** (`Source Serif 4` via `--font-serif`, Georgia fallback) —
  chosen over literal Times New Roman for legibility at small sizes.
- **Numbers go through `.num`** (`font-mono tabular-nums`), so columns of figures
  align on the decimal. Any table cell or stat holding a number uses it.
- Sizes in use: `text-xs` for table headers (uppercase, `tracking-wide`), labels,
  captions and timestamps; `text-sm` for body, nav, tables and controls;
  `text-2xl`/`text-3xl` for stat values (`.stat-value`, stepping down below `sm`);
  `text-base` only where a control is meant to read as primary (the palette
  input).
- Content is decided once and rendered signed; formatting lives in
  `lib/format.ts` (`formatAmount`, `formatQty`) and `components/SignedNumber.tsx`,
  never re-implemented with `toLocaleString` at a call site.

---

## 4. Layout

- `.panel` (`rounded-lg border border-ink-700 bg-ink-900`) is the only card
  treatment; `border-radius` defaults to 8px.
- `.table-scroll` owns **both** scroll axes (`max-h-[70vh] overflow-auto`) — an
  ancestor with `overflow-x: auto` alone silently becomes a scroll container for
  `overflow-y` too, which breaks a sticky `<thead>` in confusing ways.
- `.stat-row` / `.stat-label` / `.stat-value` for headline figures. The row wraps
  by design: a `text-3xl` figure plus its label is ~200px, so two side by side
  measured 504px on a 356px phone and dragged the document into a horizontal
  scroll.
- **Today is one screen on a desktop**: at 1440×900 and 1440×780 the page scrolls
  0px, because the chart and the largest-positions panel share a row and the chart
  takes the leftover height. Adding a tile to Today means removing something or
  re-measuring.
- Density is a decision made at a measured width, not a preference: the page
  container, the table padding and the column budgets in §5 all came from
  overflow measurements at 1440, 1024 and 390px.

---

## 5. Tables

Almost every list in the app is `.ledger-table`. Its rules are load-bearing.

- **`whitespace-nowrap` on `.ledger-table td` is not cosmetic.** With a
  content-sized table, a squeezed column broke values mid-string: `16 Sep 26`
  rendered as three stacked lines in a 67px column and tripled the row height. A
  cell that must wrap opts back in with **`.cell-wrap`** (a note, prose); a cell
  that must truncate opts in with its own width (`TickerName`'s `max-w-[13rem]`,
  the notes cells' `max-w-[16rem]`).
- **`.cell-pin`** is the pinned first column of a wide table, and its `z-index`
  layering is why the pinning is readable: body rows scroll under the header
  (`z-30`), the pinned body cell sits at `z-20`, and the corner cell — the header
  of the pinned column — at `z-40`.
- **Write selectors, not utilities.** `.ledger-table td` (class *and* element,
  0-1-1) outranks a plain utility class (0-1-0) whatever the source order, so
  `whitespace-normal` on a cell does nothing. The symptom was four paragraphs laid
  out on one 2559px line inside a 1215px cell. `.cell-wrap` and `.cell-pin` exist
  for this reason; follow the pattern rather than fighting it with `!important`.
- **Padding is `px-2`.** At `px-3` across ten or eleven columns, the extra 8px a
  cell was ~90px of width spent on nothing — and it is what pushed the widest
  ledger past its container on a laptop.
- **`.table-compact` means "the column count is unbounded"**, not "make it
  tighter". It exists for the attribution matrix, which grows a column per month
  (19 months is 21 columns and cannot fit at a readable size), so it keeps its
  horizontal scroll and its pinned first column. A five-column summary table
  inherits it too, to drop the ledger's `min-w-[720px]`.
- **Abbreviate a header before you abandon a table.** `P/L (%)` and `Txn value`
  are fine when the full wording lives in `SortableTh`'s `title`.
- **A column's width comes out of another column's.** A table that must keep all
  its columns pays for a wider cell by dropping a lower-value one at a breakpoint:
  the ledger's Note column went from 11rem to 16rem, paid for by `Txn value`
  (`hidden min-[1400px]:table-cell`). The measured minimum for the full ledger is
  **1374px**; that is where the 1400 threshold comes from.
- Row hover is `bg-ink-800/50`; headers are sticky `ink-850` with
  `border-b border-ink-700`.

---

## 6. Charts

- **One series → `accent` gold.** The portfolio line is gold because that is its
  established identity, even on a chart that also draws a benchmark.
- **More than one series → `data.*`** (benchmark steel, correlation heatmap,
  stakeholder lines). Never rely on hue alone: series also differ in **dash
  pattern and stroke weight**.
- **A loss shape is terracotta.** The underwater/drawdown curve is
  `data-terracotta`, not gold — it is a loss, and the gold is reserved for value.
- **Comparisons are rebased**, both lines to 100 at the range start, and the
  window is stated in words on the chart rather than left to the axis. A portfolio
  growth index is chained from contribution-stripped daily returns — comparing
  portfolio *value* against a price index would mostly plot the deposits.
- **Tooltips must sit above what the chart draws.** `.recharts-tooltip-wrapper`
  gets `z-20`, because Recharts renders its tooltip as an unpositioned sibling and
  a donut's centre figure was painting over its own tooltip.
- **The sparkline is hand-rolled inline SVG with no animation.** It renders once
  per row (~18 of them), and mounting 18 chart instances with their own
  `ResizeObserver`s costs far more than a string of coordinates. Its trend is
  exposed as an `aria-label`, so direction is never colour-only, and the absence
  of animation means `prefers-reduced-motion` needs no special case.
- **Range and period switches animate once.** The chart remounts under a new React
  key carrying `.swap-in` (240ms `ease-out`, fade plus 6px rise). One motion for
  the whole swap on purpose: Recharts' own 1.5s line-draw underneath two competing
  animations reads as a stutter. `.swap-in` is disabled under
  `prefers-reduced-motion: reduce` — the switch still happens, it just arrives
  instantly.

---

## 7. Interaction

- **The command palette (Ctrl/⌘ K) is the fast path**, but it is not the only one:
  the nav carries a visible filled chip reading `Search… Ctrl K` at the bar's own
  text size, because a palette nobody can discover is a palette nobody uses. The
  shortcut label is platform-aware and corrected after mount to avoid a hydration
  mismatch.
- Results are **grouped** (`ACTIONS` / `GO TO` / `LENS` / `HOLDINGS`) with the
  group heading as a `role="group"` label, and the active row is marked with a
  gold left rail *plus* a background tint. The keyboard walks the flat filtered
  list, so each row keeps its flat index and scrolling looks it up by attribute.
- **A disclosure beats a hover tooltip** (touch has no hover, and a tooltip cannot
  be re-read): `aria-expanded` on the trigger, content in the document.
- **A set-once control should not look like a frequently-edited one.** Exposure
  tags rest as a bordered chip (pencil on hover) rather than a permanently empty
  input; untagged rows show a dotted-underline `+ Add a tag` with the classifier's
  draft. Enter or picking an option commits, Escape reverts, clicking away settles.
- Below `lg`, the nav collapses into a disclosure panel that closes on navigation
  and on Escape; anything hidden from the bar (accounts, log out) reappears inside
  it, or it becomes unreachable on a phone.
- Focus is visible (`focus:border-accent`), the palette is `role="dialog"` with a
  listbox, and `::selection` uses `accent/30`.

---

## 8. Copy and voice

Plain, specific, unsentimental. The reader owns the money; the app explains the
arithmetic and admits what it does not know. Say `S$`, not "SGD", inline with the
figure.

**Rules:**

1. **A tooltip that defines a term keeps one clause.** "Money-weighted: counts when
   each contribution landed." — not a sentence about the deposit schedule.
2. **A term the reader may not know stays; a sentence about the app's own
   snapshots or a date printed twice goes.** The page keeps its glossary (the
   XIRR/TWR line, `Effective N`, the HHI bands, the correlation legend) and drops
   self-narration.
3. **Never colour a plain value** (§2), and never let colour be the only signal.
   Direction in a derived line is an **arrow** — `avg ↑`, `avg ↓` — because the
   figures around it already use colour for gains and losses.
4. **Every figure sits under its own label.** The trade-history modal moved
   realised and unrealised P/L from opposite ends of a row (~800px apart) to
   directly beneath their labels (4px), and added `Cost basis sold` and `Proceeds`
   so the realised figure can be checked rather than believed
   (`1,440 − 1,020 = 420`).
5. **Derived facts first, then the owner's words.** The ledger renders the line it
   can compute (`Opened`, `Added · avg ↑ …`, `Partial sell (10 of 15)`, `Closed`)
   unconditionally, and a stored note is appended after it. The derived half is
   `text-xs ink-500` because it was generated; the appended note is `ink-300`
   because it was written. The known consequence: truncation eats the note, not
   the facts.
6. **Keep a notice that changes how the figure above it should be read.** Kept
   deliberately, each shortened rather than removed: the value chart's "value
   change, not return" split (deposits vs market), the attribution cross-check
   that names the residual between two pricing methods, the positions-table caveats
   (rows without a live quote are held at cost and the totals understate), the
   `at cost` markers, and `Unclassified is not an "Other" sector`.
7. **Cut the furniture.** Removed on request: the late-deposit prose on `/money`
   and Today (the quiet clock badge remains, one per late month), the `N days after
   the month closed` clause, the `auto` provenance chip on tags, and the words
   that narrated data hygiene rather than data.

---

## 9. Decisions that look like mistakes

Each of these was deliberate, and most were asked for. Do not silently undo one.

- Proportion bars are gold, not a `data.*` colour (§2).
- The command palette has **no** gold top edge — it read as a warning stripe.
- `/positions/exposure` has **no** checkboxes or batch selection; the one batch
  action left is "Accept the N suggestions".
- There is **no** "Add account" button on Today; adding an account is not a daily
  act, so `/accounts` and the nav's account chip own it.
- The exposure table shows no provenance badge even though `sectorSource` is
  stored.
- There is no "Other" sector: an untagged holding is visibly unknown.
- The sparkline is hand-rolled with no animation and no chart library.
- A DCA is a note convention, not a column: the marker is the **leading word**
  `DCA`, and the form's checkbox writes it. A note that merely mentions a DCA
  elsewhere is not a marker.
- Ledger notes truncate rather than grow the row; the note cell is `16rem`.

---

## 10. Verifying a design change

Design claims in this project are measurements, not opinions.

1. **Look at the running app**, not just the diff. Read the dev server's stderr
   log as well as the browser console — an `Error` object can print as an empty
   line in the console.
2. **Measure the thing you claim.** Overflow is `scrollWidth === clientWidth`; a
   one-screen layout is `0px` of document scroll at a named viewport
   (1440×900, 1440×780, 1024×800); a contrast claim names the ratio and the
   background it was measured against, worst case first.
3. **Check both breakpoints.** Narrow (~390px) for the wrap rules, and the widest
   desktop width for the tables.
4. **Check computed styles when a class seems not to apply.** A utility losing to a
   `globals.css` selector is this codebase's most repeated bug (§5).
5. **State the number, or say you did not verify.** "Measured 0px at 1440×900" and
   "not verified on a phone" are both acceptable; "should be fine" is not.
