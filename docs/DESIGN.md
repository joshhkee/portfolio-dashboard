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
  either. One exception, for scale rather than colour: the exposure tag list's
  weight bar spans the panel, and its track is `ink-700`, because at that length
  an `ink-800` track is invisible against the panel and a gold tick floating in
  nothing is not a chart. The fill is the same gold either way.
- The value chart's dashed outlay reference line is `#5f5c57`: at `ink-500` it
  separated from the gold series by only 2.53:1 (below the 3:1 non-text floor),
  and this value gives 3.03:1 while still receding 2.81:1 against the page.

Signs and labels carry meaning alongside colour, always — a gain reads `+S$420`,
never merely green, so the figures survive a colour-blind reader and a
monochrome screenshot.

The mechanism is worth knowing because it is tested: `Percent` signs both
directions itself, including a flat `+0.00%`; `NativeMoney` takes `showPlus`,
which every P/L figure passes — and a loss is signed *without* it, because
`showPlus` only ever adds the plus; `PlainMoney` and `PlainPercent` carry neither
a sign nor a colour, since they render quantities rather than results. A P/L
figure rendered without `showPlus` is the mistake `tests/colour-rule.test.ts`
exists to catch, and it caught two.

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
- `.table-scroll` owns **both** scroll axes — an ancestor with `overflow-x: auto`
  alone silently becomes a scroll container for `overflow-y` too, which breaks a
  sticky `<thead>` in confusing ways.
- **From `lg` a table's height comes from the shell**: `.table-scroll` is `flex-1`
  with no max-height, so it is exactly as tall as its page has left for it and the
  page never moves when its rows scroll. Below `lg` it keeps the `max-h-[70vh]` cap it
  always had. The consequence to respect when writing a new table: at ≥`lg` a
  `.table-scroll` must be a flex child of a bounded column (`.screen`, `.panel-fit`,
  or a wrapper with `lg:min-h-0 lg:flex-1`), or it will size to its content and drag
  the page taller than the screen. `SkeletonTable` is the shape to copy, and it is
  the whole of a table route's body — the head row with the filter is gone with the
  filter (§7).
- **A table panel never also has a `.panel-body`.** The table IS the scroll region —
  two nested scrollers would leave the sticky header sticking to nothing. A panel of
  *non*-table rows (the exposure tag list, the cash exchange log, the account list)
  is the case `.panel-body` exists for.
- `.stat-row` / `.stat-label` / `.stat-value` for headline figures. The row wraps
  by design: a `text-3xl` figure plus its label is ~200px, so two side by side
  measured 504px on a 356px phone and dragged the document into a horizontal
  scroll.- **The shell: every page is one screen, and nothing computes a viewport height.**
  `app/layout.tsx` renders `h-dvh` with `overflow-hidden`, and `<main>` is the only
  scroll region — the last resort on a window too short for a page's fixed blocks.
  Pages are written in four classes (globals.css), and the contract binds from `lg`:

  | class | what it is |
  |---|---|
  | `.screen` | a page root: a column that fills the content region |
  | `.panel-fit` | a panel that takes its share of the screen instead of growing with its content |
  | `.panel-head` / `.panel-body` | its chrome row, and its scroll region |
  | `.page-bar` / `.stat-strip` | the row above the content: what the page is, and its figures inline |

  `min-h-0` in those rules is load-bearing: a flex item's default `min-height: auto`
  refuses to shrink below its content, so a column of `flex-1` panels still pushes
  the page past the window without it. Below `lg` none of it binds and the page is a
  document again, which is what a phone wants.
- **The chrome budget is measured once, in one place.** The nav is 48px, `main`'s
  padding is 16px top and bottom, and a section strip is ~30px plus its 16px gap — so
  a section page has ~126px of chrome and a chrome-less one ~80px. Measured at
  1440×900 with `main.scrollHeight - main.clientHeight === 0` on every route.
- **A hand-written viewport height is a bug, not a shortcut.** Today used
  `lg:h-[calc(100dvh_-_121px)]` and Exposure `xl:h-[calc(100dvh-13.5rem)]`: the same
  arithmetic twice, from two measurements taken at one width each, and both went
  stale the moment the chrome above them changed (the nav losing its wordmark moved
  them by 40px and 8px respectively). They are `flex-1` now. If a page needs the
  height of the screen, it has the shell's answer already.
- **Today is one screen on a desktop**, because the chart and the largest-positions
  panel share a row and the chart takes the leftover height. Adding a tile to Today
  means removing something or re-measuring.
- **A short `lg` window is a design case, not an edge case.** The contract starts at
  1024px *wide*, and its hardest test is 1024×**600** — a 13" laptop on Windows
  scaling lands near it. Four things were wrong there while every page was right at
  1440×900: Today was **87px taller than `main`**, the `vs index` and Risk slides
  scrolled **123px** and **122px** inside their own sub-tab, and the exposure ring
  column overflowed its 473px by **28px**. The rules that fix them, in the order to
  reach for them:
  1. **The fixed bands get denser; the flexible block absorbs it.** Anything that
     is chrome at `lg` — panel padding, the gaps inside a card, a row height — may
     tighten with `lg:p-3` / `lg:gap-2` / `lg:py-1.5`, because below `lg` the page
     is a document and wants the roomier spacing back. What may NOT change is
     content: the ring stays 176px, the five rows stay five rows, no figure is
     dropped to save height.
  2. **A control that drives a chart rides in that chart's header**, not on a row
     of its own above it. The dashboard's time range moved into
     `PortfolioValueChart`'s header via `actions` (~46px of a 600px screen).
  3. **A chart may be shorter; a panel may not scroll.** The fill-mode floors are
     `min-h-[140px]` (value and drawdown) and `min-h-[110px]` (benchmark), and each
     of those charts keeps its fixed `h-56`/`h-64`/`h-32` BELOW `lg` — the floor is
     for a short `lg` window, and a phone (where the shell hands out no heights)
     would otherwise shrink to the floor.
  4. **A list scrolls its own rows; a slide never scrolls.** A slide whose content
     is taller than its box is a slide doing too much (§7) — that is what split the
     risk pair into `Concentration` and `Risk-adjusted` rather than shrinking both
     until they fit. The exception is data: a table, the exposure tag list and the
     concentration ranking may scroll their own rows under fixed chrome, which is
     the licence §5 already gives every table.
  5. **Two columns where one is too tall.** The concentration ranking shows two
     names per row at `lg` (eight names: 208px in one column, 96px in two), and the
     page states the reading order — biggest first, left to right.
- **When a column has a fixed height, give it to the column, not the cards.**
  Splitting the height between two chart cards made the second one clip its caption
  mid-sentence at its own edge, which reads as a broken panel; letting the column
  scroll as one unit keeps each card whole and costs a single scrollbar that only
  appears on a window too short for both. Nothing inside a `.panel` should ever be
  cut in half — a panel that clips its own last line is worse than a scrollbar.
- **A block that should fill says `grow`, never `flex-1`.** `flex-1` is
  `flex: 1 1 0%`, so it lets an item SHRINK below its content as well as grow —
  which is the clipping failure in the bullet above, arrived at from the other
  direction. `flex-grow: 1` alone (`lg:grow`) keeps `flex-basis: auto`, so the
  block is its content plus a share of the leftover space, and a window too short
  for the content still overflows into the column's own scrollbar. The exposure
  page's two ring panels are the reference execution: the column, the wrapper and
  both panels are `lg:grow`, which is what turned a 380px strip of cards followed
  by 200px of empty column into two panels that fill it.
- **A panel that scrolls needs its own chrome pinned.** The tag list's rows scroll
  under a fixed header row and above a fixed closing line, so the columns never
  lose their headings; the same reasoning as `.table-scroll`'s sticky `thead`.
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
- **A cell can hold a PAIR of figures.** The holdings table stacks them: the
  figure you compare on the row's text size, the one that explains it beneath at
  `text-xs` in `ink-500`, both right-aligned so the digits line up. Value over
  quantity, price over average cost, P/L over its percentage, portfolio share
  over the holding period. Pairing figures this way took the holdings table from
  eleven columns to eight, and that width is what put all three markets on one
  page. A stack is not formatting: it is how a row carries more numbers than it
  has columns.
- **Both figures in a pair are sortable, and the header says which one is in
  charge.** A stack is not a hierarchy, so the four paired headers cycle
  `primary ↓ / primary ↑ / companion ↓ / companion ↑` and the LABEL changes with
  the state — `Value` becomes `Shares`, `Price` becomes `Avg cost`, `P/L` becomes
  `P/L %`, `Portfolio %` becomes `Held`. One control per column, no extra chrome,
  and no way to look at a column and be unsure which of its two numbers produced
  the order. `Holding` is the exception with a single state: its companion is the
  instrument's NAME, reference text rather than a figure to rank by. The first
  version of this table sorted the primary only and said so in the `title`, and
  "can we sort by the secondary row?" is why the label swaps now.
- **The sort level is stated, not drawn.** A paired header cycles four states
  (`primary ↓ / primary ↑ / companion ↓ / companion ↑`) and the reader is entitled
  to know where in that cycle they are — but the first version drew it as one dot
  per state with the current one filled, and the dots were removed on request. The
  cost was ~12px of sticky header on every table (a table row), and a second
  visual language — small round marks — that appears nowhere else in the app, on
  the one row that is sticky and therefore always on screen. What is left is the
  label swap ("Value" → "Shares"), which is what actually says which figure is in
  charge, plus the level in the button's accessible name ("Value, level 2 of 4,
  ascending"), `aria-sort` on the column, and the count in the cell's `title` —
  "2 more clicks hands the order to the other figure". Do not reintroduce the
  dots; if the level needs to be more visible, it needs a different idea.
- **A flag is a landmark, never a label.** Each market's heading carries a small
  hand-drawn flag beside the region code. It is drawn as inline SVG rather than an
  emoji, because Windows renders flag emoji as bare letter pairs, and in muted
  palette colours rather than the flags' real saturation — nothing here is colour
  for decoration, and the flag is a picture of the word already next to it. Never
  inside a table row: at 16px, in a dense ledger, that is noise. **One exception,
  asked for by the owner: the watchlist rows** (§9), where the flag sits on the
  ticker's line in place of the two-letter region code — the ticker's own line,
  because `TickerName` is a block, so a trailing span lands on a third line and
  adds a line of height to every row.
- **A column's width comes out of another column's.** A table that must keep all
  its columns pays for a wider cell by dropping a lower-value one at a breakpoint:
  the ledger's Note column went from 11rem to 16rem, paid for by `Txn value`
  (`hidden min-[1400px]:table-cell`). The measured minimum for the full ledger is
  **1374px**; that is where the 1400 threshold comes from.
- **A narrow table gets its own class, not a utility.** `.table-region` drops the
  ledger's `min-w-[720px]` for the five-column tables that sit beside each other on
  the positions page (ticker, value, price, P/L, portfolio % — measured floor
  **~560px**: figures 269px, ticker 156px, `Portfolio %` 66px, plus 12px of outer
  padding each side).
  `.ledger-table` is class-only, so a `min-w-0` utility *might* win on source
  order; declaring `.table-region` after it in the same layer is what makes it
  certain, the same mechanism `.table-compact` uses. Cells at a table's outer
  edges opt into extra padding with **`.cell-pad-start` / `.cell-pad-end`** —
  those have to be real selectors because `.ledger-table td` (0-1-1) outranks any
  padding utility, which is the third appearance of that hazard in this file.
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
- **A donut has no tooltip.** It had one, and it was removed for being in the way:
  a box that tracks the pointer sits between the pointer and the thing it
  describes, and at this size it covered the hole and both neighbouring sectors.
  Every figure it carried was already in the legend, so what replaced it is the
  ring itself — while the pointer is on a sector, that sector's name, value and
  share take over the CENTRE of the ring, and the total comes back when it leaves.
  The one thing that left the UI with the box is the per-slice holding count,
  which the hole has no room for.
- **Hover emphasises by geometry, not by colour.** A donut sector grows by 6px
  under the pointer and everything else drops to 0.35 opacity. Recolouring was
  never available: colour on that page means which bucket a holding is in, and a
  hover must not be able to restate it. Two consequences are structural rather
  than stylistic — the ring is drawn at **90%** of its 176px box so the growth has
  6px to expand into instead of being clipped flat by the edge of the SVG, and the
  legend dims from the SAME number as the ring so the two cannot disagree about
  which slice is the subject. The opacity carries the transition (a radius on a
  path cannot be eased, and the size change lands where the pointer already is);
  `prefers-reduced-motion` turns the fade off and leaves the emphasis itself,
  which is state rather than motion.
- **The sparkline is hand-rolled inline SVG with no animation.** It renders once
  per row (~18 of them), and mounting 18 chart instances with their own
  `ResizeObserver`s costs far more than a string of coordinates. Its trend is
  exposed as an `aria-label`, so direction is never colour-only, and the absence
  of animation means `prefers-reduced-motion` needs no special case.
- **Range and period switches animate once, and the offset is NEGATIVE.** The chart
  remounts under a new React key carrying `.swap-in` (240ms `ease-out`, fade plus a
  6px settle DOWN into place). One motion for the whole swap on purpose: Recharts'
  own 1.5s line-draw underneath two competing animations reads as a stutter.
  `.swap-in` is disabled under `prefers-reduced-motion: reduce` — the switch still
  happens, it just arrives instantly.
  The direction is not a taste call. A slide's content now fills its panel exactly
  (`.panel-body` → `.swap-in h-full` → content, §7), so a `+6px` start put the
  content 6px BELOW the panel's bottom edge: that is scrollable overflow, so
  `overflow: auto` on `.panel-body` showed a scrollbar for the 240ms of the swap and
  shifted the slide sideways. Content above the scrollport's start edge is not
  reachable and creates no scrollable area, so the same motion inverted costs
  nothing. Measured: 6px of overflow on every performance slide with the old
  direction, 0px with this one.

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
- **A popup has to know which way it opens.** `TagSelect`'s option list is a child
  of its row, and a scroll container clips whatever hangs out of it — so once the
  tag list became a fixed-height panel whose rows scroll, a dropdown that always
  opened downward was cut off for the last rows. It now measures the room below
  (against the nearest scrolling ancestor, or the window when there is none) and
  opens upward when that is where the space is. Any absolutely-positioned popup
  inside a bounded panel needs the same treatment.
- **A set-once control should not look like a frequently-edited one.** Exposure
  tags rest as a bordered chip (pencil on hover) rather than a permanently empty
  input; untagged rows show a dotted-underline `+ Add a tag` with the classifier's
  draft. Enter or picking an option commits, Escape reverts, clicking away settles.
- **The nav has no wordmark.** "Investments" held the top-left corner of every page
  and bought ~110px of the bar plus the weight of a brand nobody asked for: there is
  one installation and the document title already says it. Orientation is the nav's
  job, and it does it better — the active section is the lit one, and the section
  strip names it again where the lenses are.
- **There is one switch in this app, and it slides.** Every "pick one of N" control
  — the section strip, a slide deck's tab strip, a chart's range, a benchmark index,
  the stakeholder picker, the period grouping, the cash exchange's rate mode — is a
  bordered track with a **gold pill that slides** under the active item, 200ms
  `ease-out`, `motion-reduce` landing it instantly. It is defined in exactly two
  places: `useSlidingPill` (the measurement and the transform) and `.tab-track` /
  `.tab-pill` / `.tab-item` in globals.css (the look). **Never hand-roll another
  one** — write a `SegmentedControl`, or use the hook plus those classes.

  This rule exists because it already went wrong once. `SegmentedControl` slid a
  gold pill; `SectionTabs` and `SlideDeck` painted the active item `accentMuted`
  instead; the cash exchange form had a fifth, hand-written copy of the two buttons.
  The result was the same gesture looking like three different controls on three
  pages, and the owner's note — "those (light gold with the sliding animation) are
  good, update the new ones" — is why §9 no longer exempts the tabs. The pill is one
  absolutely positioned element moved with `transform`, so the motion is
  compositor-only and the selection reads as travelling.
- **An icon inside a tab inherits the tab's colour — it never names its own.**
  A tab is read as one control, so its icon and its label are one graphic with one
  contrast budget, and that budget is spent by the tab: `ink-300` at rest on the
  page (≥ 7:1), `ink-950` on the gold pill (8.54:1). Pass the bare icon
  (`<Icon size={14} strokeWidth={1.75} />`) and let `currentColor` follow.

  This rule exists because it already went wrong, and the arithmetic is why it is
  not a matter of taste: the strip's icons carried `text-ink-500` of their own, so
  on the ACTIVE tab the label measured 8.54:1 while the icon beside it measured
  **1.54:1** — under even the 3:1 floor for a non-text graphic, which is an icon
  that has in practice disappeared. `ink-500` is a legitimate token (it is the
  timestamp/hint grey, 4.75:1 at its worst, on the modal); it is simply not a
  colour that may sit on the gold. If a tab's icons ever need to look quieter than
  their label, the answer is a smaller icon or a lower `strokeWidth`, not a colour
  class. `tests/tab-colour.test.ts` holds both halves: the ratios themselves, and a
  source scan of every `app/*/layout.tsx` that fails if a `text-*` class comes back
  inside an `icon:` — the failure mode is one word in one file, which no rendering
  test would catch.
- **The section strip is one row, and it names itself.** `SectionTabs` used to be a
  `text-sm` paragraph over an underlined tab row: ~90px to say "Positions" and offer
  three links. It is now a bordered track of pills with the section's name as a small
  label beside a hairline (~30px), and the keyboard walks it with ←/→/Home/End. The
  links keep `aria-current="page"` — these are real navigations, not a tab panel — and
  the strip is a `<nav>` labelled with the section name, so the name is available to a
  screen reader even though it is visually quiet.
- **A panel with several views is a slide deck, not a stack — and a slide is one
  subject.** `SlideDeck` holds one slot with a tab strip: money's two views of outlay,
  performance's six answers to "how am I doing". Stacked, each of those cost the page
  its own height while only one was being read, and a chart with 300px of width and
  200px of height is a squashed chart. The rules the component enforces, and which any
  future deck must keep:
  - **No autoplay.** A slide that changes itself moves the figure being read.
  - **Manual, and reachable.** Every view is a labelled button, not a dot: nothing
    is discoverable only by swiping, and there is no drag-only interaction.
  - **Real tab semantics** (`tablist`/`tab`/`tabpanel`, `aria-controls` +
    `aria-labelledby`, roving `tabindex`); ←/→/Home/End move as they select.
  - **Every slide stays mounted; the inactive ones are `hidden`.** So a slide holding
    form state (the outlay pivot's inline edit) does not lose it — and `.panel-body`
    must therefore set no `display`, because any `display` rule beats the `hidden`
    attribute and would stack the hidden slides on top of each other.
  - **One subject per slide, and it fits.** More tabs is the answer to an
    information-heavy page, not a taller tab: performance's returns-and-risk was
    three slides holding seven panels, which put the drawdown curve below the fold
    of its own sub-tab, so reading it meant scrolling inside a panel that is supposed
    to be one screen. Seven slides (Value · Drawdown · vs index · Concentration ·
    Risk-adjusted · Correlation · Calendar years) is the same seven panels and no
    scrolling — and the seventh exists because the two risk halves, side by side,
    measured 63px taller than a 1024×600 panel-body: the answer to "this slide is too
    tall" is another slide, not a smaller font. A control that drives THREE slides (the time range) lives in the
    deck's head via `Slide.actions`, not at the top of each chart, so it exists once,
    travels with the slides it applies to, and does not reset between them.
  - **A slide that divides its own height works bottom-up**: `.panel-body` →
    `.swap-in h-full` → a `flex h-full min-h-0 flex-col` content div, with the block
    that gives way marked `flex-1 min-h-0` (money's "By stakeholder" = cards above a
    `.table-scroll`). The chain is why the deck's wrapper carries `h-full`: a
    percentage height needs a definite parent, and anything block-sized between them
    breaks the chain silently.
- **A filter lives on the row that already exists, never on one of its own.**
  `SearchBox` left the full-width band above each table (~40px plus a gap on every
  page with a table) for the table's `panel-head`, and then left that too for a
  page whose whole content is a list: on the ledger and the realized trades the field
  is the middle of `.page-bar`, centred between the count on the left and the actions
  on the right, and the row that held it went to the rows instead: the ledger's
  table box is **647px** tall on a one-screen page, and the row it replaced cost
  ~34px of that. The count follows the field, because "64
  entries" over twelve rows is worse than no count — `TableSearch`/`TableSearchCount`
  share the query and the filtered length between the page bar and the table, and the
  page bar reads "4 of 64 entries" while you type.

  The field then has to FILL that middle column, which is the one thing about the
  row that took two tries: a 256px field centred in a 1300px bar read as three small
  things with two long gaps between them ("it looks disjointed"). So `.page-bar`'s
  layout for this row is `auto minmax(0, 1fr) auto` and `TableSearchField` renders
  its field `w-full` — the field is the only element that can absorb width, so it
  absorbs all of it. `SearchBox` still defaults to `w-64` for a panel head, where a
  filter beside a heading should stay a filter; `minmax(0, …)` (not a bare `1fr`)
  and `min-w-0` on the wrapper are what let it SHRINK, or a narrow laptop pushes the
  export button off the bar instead of narrowing the field.

  The command palette (⌘K) stays the
  global search — pages, tickers and actions — and the nav chip is its only visible
  affordance. That chip keeps a field's PROPORTIONS (`sm:w-56 md:w-72 xl:w-96`, the
  placeholder left, the shortcut right) rather than wrapping its own text: a control
  wearing a field's clothes has to be the shape of a field, or it reads as a button
  with the word Search on it.
- **A row of panels too wide for its container is a carousel, not a scrollbar —
  and a tuck beats the carousel.** The positions page draws one table per market at
  a floor of ~560px, so a strip of them slides: 3 across from 1800px, and from
  1220px two columns with HK TUCKED UNDER SG rather than slid off the edge — show a
  market if the width can be found for it, and hide it behind an arrow only when it
  cannot (below 1220px). The tuck's price is visible and accepted: US is capped at
  70vh while SG + HK come to a few hundred pixels, so the right column ends short.
  The strip snaps one panel at a time. The arrows are derived from the scroll position rather than from the
  breakpoint (`scrollWidth` vs `scrollLeft`), so they cannot claim there is
  something to the right when there is not, and they disappear entirely when
  everything fits. The strip is `tabIndex=0` with a group label so the keyboard can
  scroll it natively, and `prefers-reduced-motion` turns the slide into a jump.
- **Below `lg` the site is a document again, and that is a requirement, not a
  fallback.** The shell's rules are all `lg:`-prefixed, so a phone gets the page it
  always had and the window scrolls it: 70vh table caps, normal flow, no clipped
  panels. The two things to check at 390px are that nothing leaks horizontally
  (`documentElement.scrollWidth === clientWidth`) and that a table that cannot fit
  scrolls inside its own box rather than widening the page — measured 0px of document
  overflow on the ledger, holdings, performance, attribution, money, cash, watchlist
  and accounts pages at 390×780.
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
7. **A sentence that qualifies a figure lives on the figure.** The prose that used to
   sit in bands above and below each page — the three-currency note on holdings, the
   "realized P/L is converted at today's rate" note, the cash-card note, the
   XIRR/TWR glossary on `/performance`, the attribution caveats, "tracked, not held" —
   is not deleted, it is relocated onto the label, column header or panel caption it
   qualifies, where a reader meets it at the moment they have the question (§8.1).
   A page's prose budget is now: one scope line if the grid needs one, and the
   controls. Four paragraphs under a table is how a dashboard became a document.
   The attribution page is the reference execution: its four bands of prose are gone
   and its facts survive as the `Instrument` header's `title` (how many instruments,
   measured from when, which are valued at cost) and the per-column `title` (which
   period each one ends, and that cells are net of money paid in). Nothing was
   dropped; the reading path is a table.
8. **Every control costs height, so a control sits in an existing row.** Actions and
   filters belong in `.page-bar` or a `panel-head` — never on a band of their own
   above the content, because that band is taken from the table on every page. A page
   whose whole content is one table puts the filter in the MIDDLE of the page bar
   (§7), which is the same rule taken to its limit: the row exists either way.
9. **A caption derived from the data, never a number typed into the copy.**
   "Portfolio gain over 19 months" was hand-written and stayed nineteen months after
   the reader chose "1Y". It now comes from the columns on screen — "Mar 25 – Sep 26 ·
   19 months" — and the line under the figure says who produced it: the biggest
   contributor with its share of the gain, how many positions are up, and the biggest
   drag. All three are computed from the rows already filtered for the selected
   window, so the caption cannot describe a different window from the grid below it.
10. **Cut the furniture.** Removed on request: the late-deposit prose on `/money`
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
- There is **no wordmark** in the nav (§7), and no page computes its own viewport
  height (§4). Both were removals rather than oversights.
- The section label is a small quiet label INSIDE the strip rather than a heading
  above it, even though that means "Positions" is never a page heading (§7).
- **Two of the exposure cuts are on screen at once and the other is behind a
  toggle.** Sector and type are the same circle sliced two ways, so they share one
  panel behind a `SegmentedControl`; currency is a different question (what the
  value is denominated in, not what it is), so it has a panel of its own beside it.
  This is the THIRD arrangement this page has had: two stacked panels (which drew the
  same ring twice), then all three behind one `SlideDeck` (which made two of them
  invisible), now stack what you compare and switch what you don't. The deck is not
  used here at all any more.
- **The gold pill is the app's switch, everywhere** (§7) — the section strip and the
  slide decks included. An earlier note in this file said the opposite (tabs and deck
  switches fill with `accentMuted` because there is "one accent per screen doing one
  job"); that was the drift the owner spotted, and it is reversed. The track's border
  still keeps the pill from reading as a call to action, and a page's primary button
  is still the only gold FILLED BUTTON — which is what "one accent per screen" was
  protecting.
- **A flag inside a table row, on the watchlist.** By explicit request: the flag sits
  on the ticker's line where the two-letter region code used to be, and the code
  lives on as the picture's accessible name and tooltip. Everywhere else §5 holds —
  a flag is a landmark beside a word, never the label itself.
- **`/money` has no tab called "Performance".** The word belongs to the section of
  this site that owns returns, risk, attribution and realized trades; a tab on a
  different page using it for "each person's share of the portfolio" made the same
  word mean a narrower thing one click away from the broader one. The tab is
  **"Returns by person"** and says what it is.
- The exposure page's tag list shows one holding per row on most desktops.
  Beside a 32rem column of charts its panel is ~1100px below a 1820px window and
  two rows need 1208px, so the two-up layout is reachable only on a wide screen.
  It is a threshold, not a broken template.

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
   - **On a page, the number that matters is `main.clientHeight` vs what the page
     puts in it**, not the document: `<main>` is the scroll region now, so
     `documentElement.scrollHeight === clientHeight` is true whether or not a page
     fits. Read `main.scrollHeight - main.clientHeight` (0 = fits) and the page
     root's own height against `main.clientHeight - 32`.
   - **On a phone, check both directions**: `documentElement.scrollWidth - clientWidth`
     for leaks and `main.scrollHeight > main.clientHeight` to confirm the document
     still scrolls, since a page that neither scrolls nor fits is a page with
     information missing off the bottom.
3. **Check both breakpoints.** Narrow (~390px) for the wrap rules, and the widest
   desktop width for the tables.
4. **Check computed styles when a class seems not to apply.** A utility losing to a
   `globals.css` selector is this codebase's most repeated bug (§5).
5. **State the number, or say you did not verify.** "Measured 0px at 1440×900" and
   "not verified on a phone" are both acceptable; "should be fine" is not.
6. **A scrollbar that appears for 240ms is still a scrollbar.** Measure overflow
   DURING a transition as well as after it — the swap-in's original `+6px` offset was
   invisible in a settled layout and added 6px of scrollable overflow on every
   switch (§6).

### The round-2 pass, as measured

Window 1440×900 (1314×821 of content after browser chrome), phone 390×780
(356px of content). `main.scrollHeight - main.clientHeight` is 0 on every page
below; `documentElement.scrollWidth - clientWidth` is 0 at both widths.

| what | number |
|---|---|
| holdings sort-header height, dots removed | 37px (the dot row was 12px of sticky header) |
| transactions table box, filter row removed | 647px |
| performance slides with any inner scroll | 0 of 6 (was: 1 of 3, over by ~40px) |
| performance slides that fill their panel | Value 598px chart, Drawdown 620px, vs index 256px |
| swap-in overflow, `+6px` vs `-6px` offset | 6px on all six slides → 0px |
| exposure column: two ring panels, filled | 348px + 335px in a 695px column |
| `/money` "By stakeholder": panel scroll | 0px (the pivot's own box scrolls 543px of rows) |
| `/money/cash` exchange rows | 5 columns, 0px of panel scroll |
| mobile horizontal leak, all changed pages | 0px |
| a tab icon's contrast, on the gold pill | 8.54:1 inherited / **1.54:1** when it names `ink-500` |
| page-bar filter field, `1fr` vs `minmax(0, 1fr)` middle column | 256px chip → fills the row (871px of 1314 at 1440) |

### Short laptop windows, as measured

1024×600 and 1280×720 CSS (`innerWidth` read back from the browser, since the
window and the CSS viewport are not the same number). Every route was walked at
both, on the base state and on every sub-tab. `main.scrollHeight - main.clientHeight`
is 0 and `documentElement.scrollWidth - clientWidth` is 0 on all of them; the
numbers below are the four defects that were there before, and the knob each fix
turned.

| what | 1024×600 before → after |
|---|---|
| Today, `main` overflow | **87px** → 0 (bands denser at `lg`, chart floor 180→140, range picker into the chart header) |
| `vs index` slide, `.panel-body` scroll | **123px** → 0 (`BenchmarkChart.fill`, 110px floor) |
| Risk slide, `.panel-body` scroll | **122px** → 0 (one slide split into `Concentration` + `Risk-adjusted`) |
| exposure ring column | **28px** over 473 → 473/473 (panel padding and gaps at `lg`; rings still 176px) |
| Concentration slide, ranking rows | 106px scroll → 0 (two columns at `lg`, 8 names in 96px) |
| Today, largest-positions list | 73px scroll → 0 at 1280×720; still scrolls its own rows at 1024×600 |
| `Correlation` slide | scrolls its own matrix (a `<table>`), unchanged at both sizes |
| deck head, 7 tabs at 1024 | 81px — the strip wraps to a second line, which `useSlidingPill` follows via its y offset |
| phone 390×780, every route and slide | 0px horizontal leak; charts keep 224px (Value), 256px (vs index), 128px (rolling) |
