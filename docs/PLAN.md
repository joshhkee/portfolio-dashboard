# Build plan — portfolio dashboard improvements

> **This file is the record, not the rulebook.** It keeps the status of every
> part and the measurements and decisions behind each one. The rules that still
> hold live in `AGENTS.md` (architecture invariants, non-goals, verification,
> conventions) and `docs/DESIGN.md` (colour, typography, tables, charts, copy).
> Machine-local operations live in the untracked `.freebuff/run.md`. Anything
> below that contradicts those three is history.
>
> Last entry: Part 38, 2026-09-25.

Segmented so each part is independently verifiable and hand-offable. Work the
parts in order; a part is DONE only when its checkpoint passes.

## How to hand this off

Paste this into any coding agent: *"Read `AGENTS.md` and `docs/DESIGN.md` in this
repo, then `docs/PLAN.md`. Follow the invariants and non-goals, then implement the
first part whose status is not DONE. Run that part's checkpoint before moving
on."*

Each part below is sized to finish in one sitting. Nothing later depends on
anything not listed as a prerequisite, so stopping between parts is always safe.

## Checkpoint protocol (identical for every part)

```bash
npm test                       # Vitest
npx tsc --noEmit               # typecheck
npx eslint app components lib tests scripts
npm run build                  # production build
```

All four must be clean, plus that part's own acceptance criteria. Do not mark a
part DONE on a partial pass — leave it IN PROGRESS with a note instead.

Then **publish the checkpoint** (owner's workflow, added 2026-09-22):

```bash
git add <the files this part touched>
git commit -m "<what changed and why>"
git push origin HEAD
```

and confirm the branch's open pull request still reports **no conflicts** —
`mergeable: true`, `mergeable_state: clean`. The four checks above must pass on
the exact pushed code. Do not merge the PR yourself unless the owner asks: the
checkpoint is "PR updated and mergeable", not "merged".

**This step is automatic** (owner's standing instruction, 2026-09-25). Every
change the owner asks for ends with these commits, a push and the pull request
updated — not only the parts in this file, and not only when asked. The old "do
not commit unless asked" gate is gone. Two exceptions, and the agent says which
one it is taking when it reports back: the owner says otherwise for a particular
change, or the change is not ready to land — checks failing, a question still
open, or work deliberately left for the owner's review before it goes anywhere.
Merging stays owner-driven.

## Pull-request workflow — required from 2026-09-22

One long-lived pull request is kept open for this branch against `main`, and
every checkpoint keeps it green:

- Remote: `origin` -> `github.com/joshhkee/portfolio-dashboard`. The branch name
  is session-owned and changes every time work is handed off, so it is not worth
  recording here; what matters is that a batch rides ONE branch and ONE pull
  request against `main`.
- A batch of work rides ONE long-lived pull request (same branch -> `main`).
  **Do not trust a PR number written in this file.** This bullet recorded #12
  when it was written; by Part 33 the branch had reached the merge of **#14**
  (`ff53615`, which is the tip of that branch's history), and the documentation
  pass after it was cut from there. Numbers and branch names move every batch, so
  ask the API which PR is open rather than reading one out of this file.
  Nothing should open a second PR while one is already open for this branch —
  but DO open a new one when the previous batch was merged, because a merged PR
  cannot be reopened to carry later work. This happens every time: the owner
  merges each PR between checkpoints, so check for an open PR before pushing
  rather than assuming yesterday's is still the one to update.
- Push normally. **Never** force-push, switch branches, or change git config.
- A clean `git push` is NOT proof the PR is conflict-free — re-read the PR and
  check `mergeable` / `mergeable_state` explicitly.
- If a conflict appears, bring the base in (`git merge origin/main`), resolve
  every conflict preserving both sides' intent, re-run the checkpoint protocol,
  then push again. Rebase only if the owner explicitly asks.
- `main` moves under this branch each time the owner merges a PR, so re-check
  mergeability before declaring a checkpoint done.

This machine has no `gh`, so the pull request is read through the GitHub API
instead — the token retrieval steps and the exact request are in the local,
untracked **`.freebuff/run.md`**, deliberately not here: this file is committed,
and a procedure for reading a credential has no business in a repository.

## Status

| Part | Scope | Status |
|---|---|---|
| 1 | Gold chart series + outlay-line separation | **DONE** (merged in #3) |
| 2 | Stock name lookup from chart meta, cached + override | **DONE** (merged in #4) |
| 3 | Contrast corrections + gold-as-data fix | **DONE** (merged in #4) |
| 3b | Multi-series data palette | **DONE** (shipped with Part 5) |
| 4 | TWR, underwater chart, range selectors, yearly table | **DONE** (merged in #5) |
| 5 | Benchmark comparison + alpha/beta (+ Part 3b palette) | **DONE** |
| 6 | Per-stakeholder performance view | **DONE** |
| 7 | Sparklines + command palette | **DONE** |
| 8 | Notes redesign (derived ledger line + one-time cleanup of stored notes) | **DONE** — 51 notes cleared, 8 rewritten, 5 kept; `notes-backup-*.json` reverts it |
| 9 | Concentration & risk analytics (HHI, Sharpe, correlation, rolling 1Y) | **DONE** |
| 10 | Exposure analytics (sector tags, currency + FX attribution) | **DONE** |
| 11 | Contribution attribution (per position, per period) | **DONE** |
| 12 | Responsive & loading polish (mobile tables, skeletons) | **DONE** |
| 13 | Range-selector transitions + load-time optimisation | **DONE** |
| 14a | Deposit schedule: `Contribution.paidOn` + a quiet late flag | **DONE** |
| 14b | Currency reporting: price-only P&L, realized FX, foreign cash | **REMOVAL DONE** (purchase-date FX split deleted); the two replacement panels are still TODO — see the Part 14b section |
| 15 | IA: five objects, lenses nested, old URLs redirected | **DONE** |
| 16 | Accounts: username + password, per-account `lastSeenAt` | **DONE** — no account created yet; make the first one at `/accounts` (Part 19) or `npm run user:add` (the shared-password gate still works) |
| 17 | Today: hero + since-last-visit, needs-attention, schedule line, one chart, largest positions | **DONE** |
| 18 | Activity: the four ledgers merged into one filterable timeline | TODO — proposed, not built |
| 19 | Accounts UI: add / reset / remove accounts at `/accounts` | **DONE** — the owner created their own account (`josh`); the bootstrap is closed |
| 20 | Today fits one desktop screen: chart beside the largest positions | **DONE** — measured 0px of scroll at 1440×900, 1440×780 and 1024×800 |
| 21 | Exposure page pass + tagging as a system (vocabulary, dropdown, suggestions, batch) | **DONE** — all 18 holdings are tagged |
| 22 | Today's movers tile (day change from quote meta) + the colour rule enforced + attention list trimmed | **DONE** |
| 23 | Command palette prominence; table sizing pass (one-line dates, no horizontal scroll on desktop) | **DONE** |
| 24 | Exposure tags as a set-once chip; site-wide text pass; late-deposit notices removed | **DONE** |
| 25 | Notes: the ledger derives its own line, and the 64 stored notes cleaned up against the owner's verdicts | **DONE** |
| 26 | Watchlist: names and today's move from the full quote pipeline, a 30-day trend, and the notes column repurposed to "why I'm watching this" | **DONE** |
| 27 | Watchlist entry signals (1y range position, % off high, RSI, 50/200-day trend) + the trade-history modal redesigned onto one scroll container | **DONE** |
| 28 | Watchlist entry-level chart (price + 1y low/high + 50-day average), a gauge-style range bar, and "How to read these" | **DONE** |
| 29 | Today's movers show the current price beside the day's change | **DONE** |
| 30 | Accounts: roles, a request-and-approve queue with josh as admin, and "Add account" on Today | **DONE** |
| 31 | Login asks for an account (three named ways in, the shared password while you wait); the ledger is renamed Transactions and every P/L figure in the history modal sits under its own label | **DONE** |
| 32 | Notes become structured: the derived facts first (`Opened` / `Added · avg ↑↓` / `Partial sell (n of m)` / `Closed`), the owner's note appended after them instead of replacing them, and a wider Note column | **DONE** |
| 33 | A DCA buy reads `DCA (month) · avg ↑` (a checkbox in the log form writes the marker); a search chip you can find; no Add-account button on Today; the watchlist explainer wraps in 2×2; the text pass on Returns & risk | **DONE** |
| 34 | Holdings: one table per market, side by side (value over shares, price over average cost, P/L over its %), sliding when three do not fit; the exposure tag list compressed to two holdings a line | **DONE** |
| 35 | Holdings, second pass: a `Portfolio %` column with the holding period under it, both figures of every paired cell sortable (the header's label changes to name the one in charge), and HK tucked under SG before the strip is resorted to | **DONE** |
| 36 | Region flags back on the market headings, redrawn; a dot per sort level under the active header; exposure rearranged into charts left / tag list right, with the donut hover enlarging the sector and dimming the rest | **DONE** |
| 37 | The donut's tooltip goes — the ring's centre becomes the readout — and the tag list's mobile rows go from four loose lines to two, with the type label against the ticker and the tag chip on the percentage's line | **DONE** |
| 38 | Exposure fits one screen: the intro sentence goes (the ring's centre says "Holdings"), the tag list becomes a fixed-height panel scrolling under its pinned column labels, and the ring goes back to 176px so both chart cards fit the column | **DONE** |

---

## Resume checkpoint — 2026-09-25 (after Part 38)

**State:** the parts listed DONE above, now through **Part 38** — a layout request
from the owner that took three passes to land ("stack the values, could the
regions share a page, and the tag list has too much empty space"), then a
correction when the first pass was not the shape they meant. What it settled:

- **Each market keeps its own table, and they sit side by side** on
  `/positions/holdings`. Stacking the figures inside a cell is what made that
  possible: five columns (ticker · value over shares · price over average cost ·
  P/L over its percentage · portfolio share over the holding period) need a
  measured floor of **~560px**, so three fit from a 1800px viewport; from 1220px
  there are two columns, with **HK tucked under SG** rather than slid off the edge;
  below that, one table per view with the strip's arrows. Measured at a 1296
  viewport: panels of 600px, tables 583 / 599 / 599, `scrollWidth == clientWidth`
  in all three, 0px of document overflow, arrows gone.
- **A header sorts both of its figures.** The four paired columns cycle
  `primary ↓ / primary ↑ / companion ↓ / companion ↑`, and the label swaps to name
  the figure in charge (`Value` → `Shares`, `Price` → `Avg cost`, `P/L` → `P/L %`,
  `Portfolio %` → `Held`). `Holding` has one state — ascending then descending by
  ticker — because its companion is the instrument's name. Each table keeps its own
  sort state: three answers to "which of these is biggest", not one answer
  pretending to be three.
- **The holding period got a column of its own.** It rode at the ticker line's
  right end and read as a loose end ("looks unnatural"); the review's ask was to
  pair it under a `Portfolio %` column — the share of the WHOLE portfolio, not of
  the row's region, which was the alternative and did not survive the question.
- **The headings are per market and in that market's money** — `US · 13 holdings ·
  US$29,811.68`, `SG · 4 holdings · S$22,736.00`, `HK · 1 holding · HK$5,104.00` at
  the time of this pass, and drifting with prices — with only the two figures above
  the strip converted to SGD. The first pass had merged all three into one table
  with a `Region` column and an SGD heading; the  owner's correction was that the regions have to read as blocks. Reversed in Part
  35, which also gave the holding period a column of its own: the header cycles
  BOTH figures of a paired cell and renames itself to say which one is ordering.
- **The market headings carry their flags again**, redrawn (a hairline `ink-700`
  edge, `crispEdges` on the US stripes, a 40% canton, and Hong Kong as a flower
  rather than a disc that read as Japan's flag). The flag is a landmark beside the
  region code, never a substitute for it, and never inside a table row.
- **The active header shows where in its cycle the table is**: one dot per state,
  the current one filled — four on a paired column, two on `Holding`, and none on
  a header that is not sorting, because a column that is not sorting has no level.
  The dots read the same `COLUMNS[].states` list a click advances through.
- **Exposure is charts left, tag list right** from 1280px up (a 32rem chart column
  and the rest for the list), with the donut legends stacking under their rings in
  that narrower column. Below 1280 it is the page it was. The donut hover now
  enlarges the sector by 6px and dims everything else to 0.35, legend included.
- **Container queries are not available in this Tailwind build** — checked with
  the CLI against the exact classes, since the tag list is now a narrow column and
  `@container`/`@[35rem]:` would have been the honest tool. Its two-up threshold
  is a viewport width (`min-[1820px]`) derived from the page's geometry instead,
  and its comment says what it is coupled to.
- **The donut's tooltip is gone.** A box tracking the pointer sat between the
  pointer and the shape it described, and it covered the hole; the centre of the
  ring now shows the hovered sector's name, value and share instead, reverting to
  the total on leave. The per-slice holding count left the UI with the box.
- **The tag list's phone layout was redone**: the type label sits against the
  ticker instead of floating mid-row (it is `ml-auto` against a desktop column
  that a phone does not have), and the tag chip rides the percentage's line, so a
  holding is two lines instead of four.
- **Exposure is one screen at `xl`.** The grid is `calc(100dvh - 13.5rem)` (the
  chrome above it measured at 216px), the tag list is bounded and scrolls inside
  its panel under pinned column labels, and the chart column is a column, not a
  stack of fixed-height cards — a fixed height split between two cards is what
  made one clip its caption mid-sentence. The page's opening sentence is gone;
  "holdings only, never cash" is now the ring's centre label.
- **The donut ring is 176px again** (192 for one pass), which is what lets both
  chart cards share the column without either scrolling.
- **`TagSelect` opens upward when there is no room below**, against the nearest
  scroll container or the window — a fixed-height list clips a dropdown that only
  ever opens downward, for its last rows.
- **The exposure tag list now runs two holdings a line** from `xl` up, which
  took the panel from **1120px to 656px** and the page from **1716px to 1252px**
  at that width — Type folded onto the ticker's line to pay for the second
  column, and the weight bar keeps whatever slack is left.

What was settled by asking rather than assumed, and the measurements behind each
number, are in the **Part 34** section at the end of this file. Nothing in this
pass touched the ledger, the engine or the API — it is presentation.

---

## Resume checkpoint — 2026-09-23 (after Part 33)

**State:** parts 1–17, 19–30 and 33 are done. **Part 33** is six fixes the owner
sent as one list, and four of them change what a **word** means rather than what
a screen does:

- **A DCA buy now reads `DCA (May 2026) · avg ↑ US$153.80`**, not `Added · avg ↑
  … · DCA · May 2026`. That was the open question at the end of Part 32 ("a DCA
  row that opens a position reads `Opened · DCA · May 2026`") and the owner
  answered it: the marker replaces the action word, the month goes in
  parentheses, no `Added`. The month is the one the note names, or the row's own
  when it names none — derived, so editing a date cannot leave a stale month.
- **The log form has a `DCA buy` checkbox**, shown only for a Buy, and it is the
  whole storage cost of the feature: it writes `DCA` (or `DCA · <your words>`)
  into the note, because `DCA` is still a **text convention**, not a column. That
  remains the first place a `kind` field would pay — see the gap below.
- **The command palette lost its gold top edge** (it read as a warning stripe,
  not emphasis) and the nav's search affordance became findable: a filled chip
  reading `Search… Ctrl K`, 14px text in a 34px box, measured 146×34 where it
  was ~85×26 at 12px.
- **The watchlist's "How to read these" was a real CSS bug, not a layout taste.**
  `.ledger-table td`'s `nowrap` **outranked** the `whitespace-normal` utility on
  the expanded cell — a class *and* an element in the selector beats a plain
  class inside the same layer — so four paragraphs laid themselves out on **one
  2559px line inside a 1215px cell**. Fixed with `.ledger-table td.cell-wrap` in
  that same layer (the `.cell-pin` pattern), and the four measures are now a 2×2
  grid: columns 575.7/575.7px, `scrollWidth == clientWidth`, 0 document overflow.
- **`Add account` is off Today** (it lives on `/accounts` and behind the nav's
  account chip), the username example is `josh`, and **the text on Returns & risk
  was cut back** — the full before/after table is in the Part 33 section.

**Known gaps carried forward:** the row editor marks a DCA only by editing the
note text (there is no checkbox there — the owner asked for the log form); four
long notes still truncate in the ledger; `DCA` is still a text convention.

---

## Resume checkpoint — 2026-09-23 (after Part 32) — kept for reference

**State:** parts 1–17 and 19–30 are done. **Part 31** closed the loop Part 30
opened: an account could be *requested* only from inside the app, which meant
the people the queue exists for could not reach it. The login page now has three
named ways in — sign in, **request an account**, and the **shared password** —
and the request is reachable **without a session**, because that is the only
moment it is useful. The shared password still opens the whole dashboard while a
request waits, and the page says so rather than implying the waiting person is
shut out.

That change is a real, deliberate re-statement of what approval means here,
confirmed by the owner against the alternative: **approval is not access
control.** The connection is already gated by the shared password, so a pending
person being able to look at the dashboard adds no exposure — what approval
decides is whose *name* the visits are recorded against. If access were meant to
be the gate, the shared password would have to be the thing that changes; see the
Part 31 section and the honest feedback in it.

The three ways in are also the whole of what changed in the security boundary:
`POST /api/users` is let past middleware so a stranger can **ask**, the route
re-checks the shared gate for the one outcome that grants (the bootstrap, which
mints a live admin), and the unauthenticated path is charged to the address and
capped by a finite queue (`MAX_PENDING_REQUESTS`). `/api/users` GET stays behind
the gate.

**Also in Part 31:** the ledger is **Transactions** (tab, palette, and the URL —
with `/positions/trades` redirecting, so nothing bookmarked breaks), the history
modal's realised/unrealised P/L figures moved from opposite ends of a row to
**directly under their labels** (measured: 4px apart, was ~800px), with **Cost
basis sold** and **Proceeds** added so the realised figure can be checked rather
than believed — `1,440 − 1,020 = 420` on the live NOW cycle.

**Part 32** then made the ledger's Note column **structured**, which is the
third shape that column has had. It was 64 duplicated names (Part 25), then a
derived line that a stored note *replaced* — so a row carrying a `DCA · Sep 2026`
or a stop-loss plan silently lost the arithmetic it had just been given. Now the
derived line renders **unconditionally** and the owner's words are **appended**
after it: `Partial sell (10 of 15) · +US$420.00 · NOW - 1st TP`, `Added · avg ↑
US$157.01 · DCA · Sep 2026`, `Opened`, `Closed · +US$253.80`. Direction is an
**arrow, never a colour** (the owner asked; the answer is in the Part 32
section), and the Note column grew from 11rem to 16rem — paid for by `Txn value`
above 1400px, a measurement rather than a preference.

The distinction that survived: the derived half stays 12px and `ink-500`,
because it is generated; the appended note is `ink-300`, because it was written.
The consequence worth knowing is that **truncation now eats the note, not the
facts** — which is the opposite of the bug Part 25 was fixing.

---

## Resume checkpoint — 2026-09-23 (after Part 30) — kept for reference

**State:** parts 1–7, 9–17 and 19–21 were already done, plus **Part 22** (Today's
movers, the colour rule, a shorter attention list), **Part 23** (a prominent
command palette, and every wide table fits a desktop window with one-line dates),
**Part 24** (set-once tag chips, and a site-wide text pass that removed the
late-deposit notices) and **Part 25** (the ledger derives its own line, so a row
no longer needs a typed note to explain itself — and the stored notes were then
cleaned up against the owner's verdicts: **51 cleared, 8 rewritten, 5 kept**,
with a backup file that reverts the whole thing in one command). The `notes`
column now holds 13 real notes instead of 64 rows of duplicated names.

**Part 26** then finished the watchlist — the last surface still hand-typing an
instrument's name. It now resolves names and the day's move from the same quote
pipeline every other page uses (which also put XLV and CRWD into the command
palette), shows a 30-day sparkline from the batched `/api/sparklines` endpoint,
and its `notes` column means "why I am watching this" rather than doubling as a
name. See the Part 26 section for the two wrong attempts at getting a free
month of prices out of the quote payload.

**Part 27** then made the watchlist answer the question it exists for — *when is
this a good buy* — with four signals from a year of daily closes (range
position, % off the 1y high, Wilder RSI(14), price vs the 50/200-day average),
shown one click below the row rather than as four more columns. It also
redesigned the trade-history modal onto a **single** scroll container, with a
position summary strip and one card per trade cycle. **Part 28** turned the
range bar into a gauge (the first version read as a draggable slider), added the
"How to read these" explainer and a year-long **EntryLevelChart**, and **Part 29**
put the current price on every row of Today's movers.

**Part 30** gave accounts roles, which is the first change here that is not
about reading data: `role` + `approvedAt` on `User`, an approval queue for
requests, `josh` as the admin, and an **Add account** button on Today. A member
can ask for an account (it cannot sign in until an admin approves it) and can no
longer reset or remove anyone — including the admin, which would otherwise have
been a way straight around the queue. See the Part 30 section.

**The colour rule, now written down because it was violated in four places:**
colour means *up or down*. Gains, losses, returns, and percentages carry
green/red; a plain VALUE never does, however positive it is. That means the
portfolio total, a holding value, the total outlay, and the contributed /
current-value columns are neutral ink — `PlainMoney` / `formatAmount`, not
`NativeMoney` / `Money`. The attribution grid and its "biggest contributors"
panel are gains, so they stay coloured. `Money`, `Percent` and `NativeMoney`
colour by sign; reach for `PlainMoney` or `formatAmount` for anything that is
not a gain or a loss.

**The table rules, so the next pass does not undo them:**

- `.ledger-table td` is `whitespace-nowrap`. A cell that must wrap or truncate
  opts in with its own width (`TickerName`'s `max-w-[13rem]`, the notes cells'
  `max-w-[16rem]` since Part 32 — it was `11rem` before, which could fit the old
  ~24-character derived line and nothing longer). Without this, "16 Sep 26"
  broke across three lines in a 67px column and tripled the row height.
- Ledger padding is `px-2` (was `px-3`) — 8px a cell times ten columns was ~90px
  spent on nothing, and it was what pushed the trades ledger (1531px) past its
  1218px container.
- `.table-compact` is for a table whose **column count is unbounded** (the
  attribution matrix grows a column per month), not a style preference.
- Column headers may be abbreviated to keep a table inside its container
  (`P/L (%)`, `Txn value`); the full wording goes in `SortableTh`'s `title`.
- **A column's width comes out of another column's.** The ledger's Note column
  is the one cell whose contents vary in width, so Part 32 paid for its extra
  room with `Txn value` (`hidden min-[1400px]:table-cell`): pure arithmetic on
  two columns that stay on the row, so a narrow window loses width rather than
  information. Measured minimum window for the full table: **1374px** — hence
  the 1400 threshold, which is a measurement, not a round number.

**Kept on purpose through the text pass** (each one changes how a figure above
it should be read, so none of them is decoration): the value chart's "value
change, not return" caption with the deposits-vs-market split; the attribution
cross-check line that names the residual between the two pricing methods; the
positions-table caveats that rows without a live quote are held at cost and the
totals understate; the `at cost` markers; and the "Unclassified is not an Other
sector" note on the donut. Everything else was cut or shortened.

**Also worth knowing:** `npm run build` runs `prisma generate` first, which fails
with `EPERM` while the dev server is running (the server holds
`query_engine-windows.dll.node`). Run `npx next build` directly in that case, or
stop the dev server first — the failure is the file lock, not the code.

**Next action (owner's call):** still open — **Part 18** the merged `/activity`
ledger, modelling the **stop-loss / take-profit levels** the notes still carry as
text (the owner's chosen follow-up to Part 8), and the **monolith split**
(`app/page.tsx`, `lib/portfolio-engine.ts`). Part 26 closed the last hand-typed
name in the app: the watchlist now resolves its own names, and its notes column
is a reason rather than a duplicate of the ticker.

---

## Resume checkpoint — 2026-09-22 (after Part 21) — kept for reference

**State:** parts 1–7 and 9–17 finished and verified, plus **Part 19** — the
accounts UI (`/accounts`: create, reset, remove), with the bootstrap rule that
lets the shared-password visitor create the very first account in the browser
instead of a shell — **Part 20** — Today now fits one desktop screen (the
chart and the largest positions share a row, the chart takes the leftover
height, and the late-month count is gone from the page) — and **Part 21** — the
exposure page rebuilt around a ten-tag vocabulary: a real tag dropdown, a
funds-vs-stocks view that needs no tagging at all, per-row suggestions the owner
accepts rather than applies, batch tagging by selection, and the donut's centre
figure no longer fighting its own tooltip. Earlier this round: the
**14b removal** (the `/exposure` purchase-date FX split and its machinery are
gone), consistent `S$` labelling, the **five-object IA** with the old URLs
redirected, **accounts**, and the **dashboard rebuilt as Today** — 12 panels to
4, 4 charts to 1, 448 rendered figures to 31.

**Next action (as of that checkpoint):** the owner asked for the exposure page
first and the rest of the tabs after ("and later all the tabs, check them in the
preview for unnecessary space or other out of place features"), so the next UI
pass was **`/money`, `/performance`, `/positions/us|sg|hk`, `/positions/trades`
and `/watchlist`** — which Parts 22–24 then did. After that, whichever the owner
picks — **Part 18 the `/activity` ledger**, **14b's two remaining panels**
(realized FX on the 25 conversions; unrealized FX on the foreign cash), the
**monolith split** (`app/page.tsx` and `lib/portfolio-engine.ts` are both large
enough that a maintainer would flag them), or **Part 8** (notes redesign — that
decision was made and the work shipped in Part 25).

**The accounts state to be aware of before touching auth again:** the owner's
account **`josh` exists** (created on `/accounts` on 2026-09-22), so the
bootstrap is closed: the shared password still signs in but can no longer manage
accounts, and only an account can add more. Every temporary verification account
was deleted after use; the `User` table is otherwise empty.

**Environment notes that are easy to lose:**
- The database is SHARED with the main checkout, so a migration or an account
  created here is already live for the deployed app.
- `AUTH_SECRET` is optional. With it unset the signing secret falls back to
  `SITE_PASSWORD` (so changing the shared password signs every account out);
  set it before rotating the shared password if that matters.
- `npm run user:add` can run with the dev server up — it uses its own Prisma
  client. Only `npm run build` collides with a running server (the Windows
  Prisma engine DLL lock documented in the run doc). Since Part 19 the CLI is
  the fallback: `/accounts` does the same job in the browser, and is the only
  way to reach it when you have no account yet.
- The `User` table being empty is load-bearing (see the checkpoint note above):
  it is what makes `/accounts` reachable with the shared password.
- `npx tsc --noEmit` reads generated route types from `.next`, so it reports
  phantom errors about deleted routes until `.next` is rebuilt after a move.
(This heading has tracked each batch — "after Part 11", "after Part 14a", "after
Part 14b" — and the body below is kept because its data-quality findings are
still current.)

**Part 10 / Part 21 and the database:** migrations
`20260922140000_add_ticker_sector` and
`20260922170000_add_ticker_sector_source` are both applied (the second is
nullable and additive, so the deployed revision that does not know the column
exists keeps working against the same shared database). **No sector tags are
stored yet** — the DB is exactly as it was found after Part 21's write test, so
the sector donut correctly reads Unclassified 100% until the owner tags
instruments on `/exposure`. One click does all eighteen: "Accept the 18
suggestions".

**Git:** parts 1–4 merged into `main` through pull requests #3, #4 and #5
(`6a357af`, `c166bf0`, `c6071c5`); the Ctrl+K / benchmark-explainer notes plus
the parts 8–12 backlog through #7; part 9 through #6. Both #6 and #7 are MERGED,
so part 10 onward rides a fresh pull request (see below) — check the open PR's
number before quoting it, it changes each batch. **#9 was merged** (its squash is
`main` at `0927f2c`), so parts 15-17 went up as a NEW pull request: **#10**, open
and reading `mergeable: true / clean`, with Vercel green on its head commit. **One pull request per checkpoint** (see "Pull-request
workflow") — never force-push, and re-read the PR's `mergeable_state` after
every push, because GitHub computes it asynchronously and it reads `unstable`
while CI runs.

**Verification on the current tree (all green at the end of this session):**

```
npm test                                     -> 17 files, 270 tests passed
npx tsc --noEmit                             -> clean
npx eslint app components lib tests scripts  -> clean
npm run build                                -> succeeded (see the build note below)
```

(The count went 230 -> 216 when the 14 FX-split tests left with their code, then
216 -> 229 with Part 16's 13 auth tests, 242 with Part 19's 13 account-rule
tests, 248 with Part 20's 6 sparkline-key parser tests, and 270 with Part 21's 15
sector-classifier tests plus 7 exposure tests (`instrumentTypeExposure`,
`capBreakdown`) and the `ExposureLine` fixture's new field. Note `scripts/` is in
the eslint target — the create-user script is app code and should be linted like
the rest.)

**Live preview:** a dev server runs from this worktree, but **Next picks the
port** — 3000 when it is free, otherwise a random high one (it landed on 59495
last). Read the "Local:" line in
`.freebuff/preview-29b0adb2-a864-46b1-9352-6fb3fcb2b204.log` instead of assuming
a port, and probe the URL before starting another server: a Freebuff app
restart kills any server started in an earlier session, but a *detached* one
can survive, so check first to avoid stacking duplicate servers. Full
procedures are in `.freebuff/run.md`.

**What to do first tomorrow:**

1. `npm install` if `node_modules` is missing, then confirm `.env` exists (copy
   from the main checkout) and that `DATABASE_URL` is quoted **around** the
   whole URL including any query string — see the env note below, this cost
   real debugging time.
2. `npm run dev` and confirm the home page renders: hero, value/drawdown
   charts, benchmark panel, calendar-year table and the **risk & concentration
   panel** (HHI 14, volatility 14.1%, Sharpe 0.40, rolling-1Y line, an 18×18
   correlation matrix once the client fetch returns). Then confirm `/exposure`
   renders: two donuts, the local-vs-currency P&L split with a totals row that
   adds up, and the tag editor.
3. Read the Part 12 section, follow its acceptance criteria, then run the
   checkpoint protocol.

**Build note:** `npm run build` runs `prisma generate` first, which fails with
`EPERM` while a dev server holds Prisma's engine DLL. `npx next build` is the
same build minus that step (the dev server has already generated the client).
Both rewrite the tracked `next-env.d.ts` between dev and prod paths — revert that
churn so the tree stays clean.

**Open items deliberately not done:** Part 8 (notes redesign) is still blocked on
an owner decision — see that section. Part 3b's six-colour `data` palette is
shipped and in use (benchmark chart, stakeholder chart, correlation heatmap);
the **bars** stay gold by the owner's explicit choice.

**Known data-quality issue #2 — the ledger and the cash balances disagree.**
Measured 2026-09-22 by the cash check on `/attribution`, AFTER the ledger
correction in Part 14: contributions total **S$54,697.00**, the ledger says
**S$3,650.62** should still be uninvested, and the `CashBalance` rows hold
**S$4,597.47** — so the balances now hold **S$946.85 MORE** than the ledger
implies. (Before the correction this read as a shortfall of S$1,252.82;
removing the duplicate March-2025 month moves it by exactly +S$2,200, so the
flip is the correction, not a new mystery. A SURPLUS points at money that
arrived without a matching contribution row — a dividend, interest, or a
deposit not in the sheet — rather than at a trade missing its cash leg.)

Nothing stores or derives from this gap: `/attribution` never touches cash, and
the overview hero uses the recorded balances (invariant 2), so both pages are
internally consistent. It surfaces only where the two are compared, and the
likely causes are a trade logged without its cash movement, an unlogged
withdrawal/transfer, or a hand-corrected balance (which is allowed by design).
The page prints the gap rather than hiding it. Per-month drift is under S$22 for
every month except the current one, which is where a live balance meets
backfilled history — so if this is ever chased, start there.

The other kind of reconciliation now lives in Part 11: the tracking grid vs the
snapshots' own stored holdings values, which agree to **S$38.33 over 19 months
(0.36%)** — two independent price histories agreeing, which is the check that
would catch a break in either.

**Known data-quality issue #1 — read before touching volatility or TWR:** the
`DailySnapshot` for **2025-03-05** is ~S$1,150 low, and that one day carries
**32.4% of the portfolio's total variance** (volatility 14.11% vs 11.61% without
it, Sharpe 0.38 vs 0.47, annualized TWR 9.19% vs 16.82%). It is genuinely in the
stored data, not a clamp or an arithmetic bug, so nothing filters it — the risk
panel reports it rather than dropping it. See the Part 9 section for the full
measurement.

---

## Where the rules live — moved 2026-09-24

The three sections that used to sit here — the architecture invariants, the
non-goals, and the environment notes — moved to the documents a reader opens
first, instead of sitting 450 lines inside the build history. One copy is the
whole point: a rule stated twice drifts.

- **Architecture invariants and non-goals → `AGENTS.md`.** All six invariants
  (derived-never-stored, the `CashBalance` exception, frozen snapshots,
  `region::ticker` price keys, the full-ledger quantity scan, and `migrate diff`
  rather than `migrate dev`), plus the two features the owner has rejected.
- **Environment and setup → `README.md`.** `DATABASE_URL`, `SITE_PASSWORD`,
  `AUTH_SECRET`, `PRISMA_CONNECTION_LIMIT`, the pooler's 15-session cap, and
  `migrate deploy` rather than `migrate dev`.
- **Machine-local operations → `.freebuff/run.md`** (untracked, not part of the
  project): the dev server's port, the Windows Prisma engine lock, `.env`
  quoting, and how the open pull request is read from this machine.
- **Design rules → `docs/DESIGN.md`.** Colour, typography, table and chart
  conventions, motion, and the copy/voice rules the text passes settled.

---

## Part 1 — Gold chart series — DONE

`components/PortfolioValueChart.tsx`: value series moved from steel blue
`#7d97b3` to the gold accent `#d4a94a` (gradient stops, `<Area>` stroke,
`activeDot`). The dashed outlay reference line moved from `#6b6862` to
`#5f5c57`, because gold-vs-ink-500 separated at only 2.53:1 (below the 3:1
non-text guideline); `#5f5c57` gives 3.03:1 while still receding 2.81:1 against
the page. The component doc comment was rewritten — it previously asserted gold
was chrome-only, which is no longer true.

Measured: gold 8.54:1 on page background (blue was 6.20:1), 7.93:1 on panels,
6.19:1 against gridlines. Tooltip is untouched and unaffected (13.52:1 / 6.46:1).

---

## Part 2 — Stock name lookup — DONE

`fetchCompanyName()` called `v7/finance/quote`, which returns **HTTP 401** — so
`TransactionHistoryModal` has been silently rendering the bare ticker via its
`{companyName || ticker}` fallback. Meanwhile `v8/finance/chart/{symbol}`, the
endpoint `fetchQuote` already calls successfully, returns `longName`,
`shortName`, `instrumentType`, `fullExchangeName`, and `currency` in
`chart.result[0].meta`. The fix therefore REMOVES a network call per ticker.

Steps:

1. `lib/prices.ts`: add `QuoteMeta`, a pure exported `parseChartMeta(data)`,
   and `fetchQuoteMeta(symbol)`. Reimplement `fetchQuote` as a thin delegate so
   `lib/fx.ts` keeps working unchanged. Add `fetchPositionQuotes(positions)`
   returning `{ prices, meta }` from one call per unique ticker. Delete
   `fetchCompanyName` (single caller, updated in step 3).
2. `prisma/schema.prisma`: add `TickerMeta` — `region` + `ticker` unique,
   `name`, `instrumentType`, `exchange`, `currency`, `nameOverridden Boolean
   @default(false)`, `fetchedAt`, `updatedAt`. Migration SQL via `migrate diff`,
   applied with `migrate deploy`, then `npx prisma generate`.
3. New `lib/ticker-meta.ts`: pure `mergeMeta(existing, incoming)` where a
   hand-edited name always wins and auto-lookup only fills blanks; plus
   `getCachedNames(keys)` (DB-only, safe on render paths), `ensureTickerMeta()`
   (upsert, skipping overridden rows), `setTickerNameOverride()`.
4. New `app/api/ticker-meta/route.ts` with `PATCH` for the manual override.
5. `lib/get-positions.ts`: use `fetchPositionQuotes`, persist meta, attach
   `name` to each row.
6. Surface names: `components/PositionsTable.tsx` (subtitle under the ticker +
   inline override editor), `EditableTransactionRow`/`TransactionsTable`
   (ledger), `CompletedTradesTable`. `TransactionHistoryModal` needs NO change —
   it already renders `companyName` and starts working once the API returns one.
7. Tests: `tests/prices.test.ts` for `parseChartMeta` (real payload shape,
   missing meta, null-name fallbacks) and `tests/ticker-meta.test.ts` for
   `mergeMeta` override precedence.

**Acceptance:** names resolve for the existing holdings and in the ledger;
a hand-edited name survives a re-fetch; the history modal shows a real name
instead of the ticker.

**Out of scope:** do not touch the `notes` column or redesign notes. The owner
has not chosen among those options.

---

## Part 3 — Contrast corrections — DONE

Measured WCAG ratios against the three background levels (`ink-950 #121212`,
`ink-900 #1a1a1a` panels, `ink-850 #1d1d1d` table heads):

- `ink-500 #6b6862` measures **3.04–3.37:1** — fails AA (needs 4.5). It appears
  in 17 places as `text-xs` timestamps, hints, and percentages. Change to
  `#8a8680` (4.66 on table heads, 5.18 on page).
- `loss #b06d64` measures 4.32:1 on panels — marginal fail. Change to `#b8756b`
  (4.80) or `#c07f74` (5.41).
- Gold-as-data contradiction: `tailwind.config.ts` documents gold as chrome,
  but `app/page.tsx` and `components/AllocationCards.tsx` fill proportion bars
  with `bg-accent/70`. Move data bars off the chrome accent.
- Add a muted data palette (all measured ≥5.7:1 on `ink-950`): steel `#7d97b3`,
  sage `#7fa87a`, terracotta `#c07f74`, muted gold `#c9a86a` (desaturated cousin
  of chrome gold — never use `#d4a94a` for multi-series data), mauve `#9b8ab8`,
  teal `#6fa8a3`.

What was actually done:

- `ink-500` `#6b6862` → **`#8f8b85`**. The first candidate (`#8a8680`) measured
  4.45:1 on the modal background — a marginal fail — so the final value was
  chosen against the worst-case background, not the page: 5.53:1 on page,
  5.14:1 on panels, **4.75:1 on modal `ink-800`**, the tightest case.
- `loss` `#b06d64` → **`#c07f74`**. Same reasoning: `#b8756b` measured 4.45:1
  on the loss badge background, so `#c07f74` was used instead — ≥5.0:1 in every
  context. Gains/losses also always carry an explicit +/− sign, so they never
  depend on hue alone.
- Proportion bars briefly moved off gold onto a `data` token (`#7d97b3`), on
  the argument that gold should only mean "interactive". **The owner reversed
  this: the holding-value region bars (`app/page.tsx`) and the outlay
  stakeholder bars (`AllocationCards.tsx`) use `bg-accent/70` (gold) by
  explicit preference.** Do not "correct" them back to a data colour — the
  `data` token was removed again for that reason. Gold on the `ink-800` track
  measures ~7.5:1, comfortably above the 3:1 floor for graphics, so there is
  no accessibility argument for changing it either.

Deliberately NOT done: the six-colour multi-series palette. With one chart
series in the app there is nothing to colour, so those tokens would sit unused
until Part 5 introduces a second series. Add them there.

**Acceptance met:** the two failing pairs pass AA in every context they appear.
The proportion-bar colour is intentionally gold, per the owner.

---

## Part 4 — TWR, underwater chart, range selectors — DONE

- Time-weighted return alongside XIRR, chained from `DailySnapshot`
  (`totalValueSgd` + `costBasisSgd`), neutralizing contribution timing. XIRR is
  money-weighted and rewards *when* money landed; TWR isolates the strategy.
- Underwater (drawdown-over-time) curve; its minimum must equal
  `maxDrawdown()`'s value.
- Range selectors (1M / 3M / YTD / 1Y / 3Y / All) driving both charts, plus a
  calendar-year return table.

**Acceptance:** TWR differs from XIRR when contributions are uneven and matches
it for a single lump sum (prove with a unit test).

What was actually done:

- **`lib/performance.ts`** (new, pure — no DB, no network): `filterByRange`,
  `timeWeightedReturn`, `annualizeReturn`, `drawdownSeries`, `yearlyReturns`,
  the `PerfPoint` / `RangeKey` types and `RANGE_KEYS`. Per-day return is
  `(V_t − V_{t−1} − newMoney_t) / V_{t−1}`, where `newMoney` is the day-over-day
  rise in cumulative outlay — which is exactly why `DailySnapshot` stores
  `costBasisSgd` next to the value, so no extra query is needed. Guards: a
  zero/negative base is skipped, a single day worse than −100% is clamped (a
  data artefact must not flip the compounded sign), and a span under 30 days
  refuses to annualize.
- **`maxDrawdown()` in `lib/snapshots.ts` was refactored to delegate to
  `drawdownSeries`**, so the headline number and the underwater curve cannot
  drift apart. A test pins `min(drawdownSeries) === maxDrawdown()`.
- New components: `PortfolioPerformance.tsx` (range picker + both charts),
  `DrawdownChart.tsx` (underwater curve, terracotta — it is a loss shape, so it
  is not gold), `YearlyReturnsTable.tsx` (factsheet-style calendar-year table).
  Wired into `app/page.tsx`; `PortfolioValueChart` now accepts a pre-filtered
  series so one picker drives both charts.
- **Hero now shows XIRR and TWR side by side**, which is the whole point: on
  this real data they read **+16.99% XIRR vs +8.92% TWR**. The gap is the
  contribution-timing effect — XIRR is money-weighted and credits the owner for
  *when* money landed, TWR strips that out and describes the strategy.
- `tests/performance.test.ts` (new, 12 tests) covers lump-sum equivalence, a
  contribution that must NOT register as growth, chained multiplication,
  drawdown/`maxDrawdown` agreement, every range selector, and the guards.
- **Fixed during verification:** the calendar-year table inherited
  `.ledger-table`'s `min-w-[720px]`, so a five-column summary table scrolled
  sideways inside its own panel. Added a `.table-compact` variant in
  `app/globals.css` (declared after `.ledger-table` so it wins by source order
  inside the layer — a `min-w-0` utility does NOT reliably override it, because
  the bundler may emit utilities before components). Measured overflow at a
  470px container: 250px → 55px (min-width removed) → 14px (tighter
  padding, `px-2`) → **0px** (`text-xs` on this table's cells).

**Acceptance met.** TWR is pinned against XIRR by unit tests for both the
single-lump-sum case and the uneven-contribution case, and the divergence is
visible on the live page (+16.99% vs +8.92%).

## Part 5 — Benchmark comparison — DONE

Overlay `^GSPC`, `URTH`, `^STI` via `fetchHistoricalCloses`, with alpha and beta
from regressing daily portfolio returns on benchmark returns.

What was actually done:

- **`lib/benchmarks.ts`** (new — the fetch plus all the math, kept pure so the
  regression is tested against arithmetic rather than pixels): `BENCHMARKS`
  (`^GSPC`, `URTH`, `^STI`), `getBenchmarkCloses`, `alignCloses`,
  `rebaseTo100`, `benchmarkDailyReturns`, `portfolioDailyReturns`,
  `growthIndex`, `alphaBeta`.
- **The portfolio line is a growth index, not raw value.** Comparing portfolio
  *value* against a price index would mostly plot the owner's monthly deposits,
  because every deposit steps the line up. `growthIndex()` chains Part 4's
  contribution-stripped daily returns instead, so both lines measure the growth
  of money already invested — the same quantity an index measures. A test pins
  that a deposit which raises value 100 → 150 with 50 of new money is a **0%
  return**, not +50%.
- **Alignment:** benchmark series are trading-day only while `DailySnapshot`
  rows are calendar-daily, so `alignCloses` carries the last close forward
  across weekends/holidays and returns `null` (never a back-filled value)
  before the index has data. Both arrays stay 1:1 with the snapshot series so
  the range slice cuts them by the same offset — pairing returns from different
  dates would silently produce a wrong beta.
- **Bounded Yahoo calls:** `getBenchmarkCloses` keeps a 15-minute TTL cache
  plus single-flight, so calls are bounded by the number of INDICES (three),
  not by positions, days, or page loads. An empty result is deliberately not
  cached, so one transient Yahoo failure can't blank the chart for 15 minutes.
- **Part 3b palette shipped here:** `data.*` tokens (steel, sage, terracotta,
  gold, mauve, teal) in `tailwind.config.ts`, all measured ≥5.7:1 on the page
  background. The benchmark line is `data-steel`; the portfolio keeps `accent`
  gold because that is the established single-series colour and the owner's
  choice. The two series also differ in dash pattern and stroke weight, so the
  comparison never depends on hue alone.
- **The alpha/beta stat row is labelled with its window** ("Alpha vs S&P 500
  (ann.)", plus Beta, R², Correlation and Days compared), and the chart states
  the rebase date and the window span in words.

**Measured on the real ledger over 2 Mar 2025 – 22 Sep 2026 (569 days): alpha
+2.3%/yr, beta 0.35, R² 0.18, correlation 0.42.** A beta of 0.35 is the
interesting part: this portfolio moves roughly a third as much as the S&P,
which is what a large cash balance plus SG/HK holdings should look like.

**The verdict genuinely splits both ways, which is why the explainer reports
two answers:** the portfolio returned **+14.7%** contribution-neutral against
the S&P's **+30.4%** (so it LAGGED the index by 15.7 points), while beta 0.35
means the index's move alone predicted only **+10.7%** — so **+4.0 points came
from something other than market exposure**, in the portfolio's favour. "Behind
the index, ahead of its risk" is the honest reading, and a single flag would
have hidden it.

**Owner follow-up (2026-09-22):** added `components/BenchmarkExplainer.tsx` — a
collapsible write-up under the statistics, answering "am I outperforming?" in
plain words. It is a disclosure with `aria-expanded`, not a hover tooltip
(unreachable on touch, impossible to re-read). `benchmarkVerdict()` in
`lib/benchmarks.ts` derives it from the same two series the chart draws, and
deliberately reports TWO answers, because they can disagree:
`outperformedBenchmark` (cumulative vs the index) and `beatBetaExpectation`
(versus what the fitted beta predicts). On this portfolio they DO disagree —
see the Part 5 measured note below.

**Acceptance met:** both series rebased to 100 at range start (verified in the
rendered page), alpha/beta labelled with their window, and the extra Yahoo
calls are bounded to three per 15 minutes.

**Verified how:** `npm test` (92 tests), `tsc --noEmit`, `eslint`, build, and
the stat values read back out of the rendered page.

## Part 6 — Per-stakeholder performance — DONE

Each contributor's pro-rata share of current value, their own XIRR, total
contributed, and a contribution-vs-value timeline.

What was actually done:

- **`lib/stakeholders.ts`** (new, pure — no DB, no network): `splitByStakeholder`
  and `stakeholderTimeline`, with the `ContributionLike` / `StakeholderRow` /
  `StakeholderTimelinePoint` types.
- **Ownership is derived, never stored.** A stakeholder's share is their
  contribution over total contributions, and their current value is that share
  times the portfolio total. Storing a balance would be a second source of
  truth that could drift from the ledger — the exact thing the invariants
  forbid.
- **XIRR reuses `lib/xirr.ts`** with the same cashflow shape the overview
  builds (each contribution as money in on its real date, then one positive
  flow for that person's current value). No second solver, so the per-person
  numbers can't drift from the headline XIRR.
- **The timeline denominator is the snapshot's own `costBasisSgd`**, which
  makes the series self-reconciling: on any date the per-stakeholder values add
  up to exactly that day's `totalValueSgd`, by construction. A test pins that
  for every snapshot in the series. Contributions dated after a snapshot's day
  are held back until the first snapshot on or after them.
- New component `StakeholderPerformance.tsx`: a table (stakeholder, contributed,
  share, current value, gain, XIRR, plus an explicit **Total** row) and a chart
  that defaults to all stakeholders and switches to one person to compare their
  value line (solid, palette colour) against what they put in (dashed steel).
  Wired into `/outlay`, under "By stakeholder".
- `/outlay` now computes the portfolio total the same way the overview does
  (holdings + cash, SGD) rather than reusing a stale snapshot, because the whole
  point of these shares is that they reconcile with the headline number.

**Measured on the real ledger:** Keng 31.36% / +15.98% XIRR, Roy 21.09% /
+17.05%, Zhiming 21.09% / +17.05%, Josh 19.78% / +18.63%, Chin 6.68% / +20.60%.
The later contributors show the higher money-weighted returns, which is the
expected direction when the market rose after their money went in.

**Acceptance met:** all five stakeholders listed, and the stakeholder total
equals the overview total exactly — measured at delta 0.00 across four
consecutive paired requests.

**Note on comparing the two pages:** live prices move, and the overview and
/outlay are separate requests, so they can briefly disagree by a few dollars
(one earlier sample differed by S$5 while the overview's own total moved from
66,451 to 66,444 between two calls seconds apart). Compare them in the same
instant; the delta should be 0.00. This is price drift, not a rounding
mismatch in the split.

## Part 7 — Sparklines + command palette — DONE

30-day mini-trends in the positions tables, and a Cmd/Ctrl+K palette to jump to
a ticker, log a transaction, or navigate.

What was actually done:

- **`lib/sparklines.ts`** (new): `getSparklines` (15-minute TTL cache +
  `mapWithConcurrency` at 4 in flight, capped at 60 symbols per request) plus the
  pure helpers `trendOf` and `toSparklinePoints`. `fetchHistoricalCloses`
  already sits behind Next's 1h fetch cache, so the cache here covers the
  shaping and the concurrency bound.
- **`app/api/sparklines/route.ts`**: every row's series in ONE request, batched
  on purpose — a per-row endpoint would be an ~18-request waterfall every time a
  positions page opens. Tickers with no usable history are omitted rather than
  faked, so a row with no data shows a dash.
- **`components/Sparkline.tsx`**: a hand-rolled inline SVG polyline, not a chart
  library — this renders once per row, and mounting ~18 chart instances (each
  with its own ResizeObserver) costs far more than a string of coordinates. No
  animation at all, so `prefers-reduced-motion` needs no special case, and the
  trend is exposed as `aria-label` so direction isn't colour-only.
- **`lib/command-search.ts`** (new, pure): `filterCommands` with tiers (exact →
  label prefix → word prefix → substring in label/hint/keywords), alphabetical
  tie-break so the list doesn't reshuffle between keystrokes, plus
  `OPEN_PALETTE_EVENT`. 12 unit tests.
- **`components/CommandPalette.tsx`**: global Cmd/Ctrl+K, arrows (clamped, not
  wrapping), Enter, Escape; input focused on open; `role=dialog` +
  `role=listbox`/`option` with `aria-activedescendant`. Tickers come from
  **`app/api/palette/route.ts`**, which is DB-only (names from the `TickerMeta`
  cache, no Yahoo), fetched once on first open and memoized in state.
- **Discoverability:** `components/Nav.tsx` gained a small shortcut chip that
  fires `OPEN_PALETTE_EVENT` — a custom event instead of shared React state, so
  the trigger and the palette need no context provider or prop drilling. The
  label is platform-aware (owner is on Windows, asked for Ctrl+K): it renders
  "Ctrl K" and switches to "⌘K" after mount on a Mac. Defaulting to the
  non-Mac label server-side is deliberate — `navigator` doesn't exist during
  SSR, and a stable default keeps the server HTML and first client render
  identical.
- **Real "jump to a ticker":** the palette links to
  `/holdings/<region>?ticker=…`, and `PositionsTable` reads that param to
  highlight the row and scroll it into view (honouring reduced-motion for the
  scroll itself).

**Bug found only by exercising the UI:** the first cut looked up sparkline data
with a single-colon key (`US:VOO`) while the API returns the app's compound
`US::VOO` keys (invariant 4). Every cell rendered empty — the unit tests and the
endpoint both passed, so only driving the real page caught it. Fixed by going
through `priceKey()`.

**Acceptance met, verified in the running app:** 13/13 US rows and all SG rows
show sparklines with real trends (+1.6%, −11.4%, +18.6% …); the palette opened
from the chip, filtered `d05` to "SG D05 · DBS Group Holdings Ltd", and Enter
navigated to `/holdings/sg?ticker=D05` with exactly one row highlighted and
scrolled into view.

**Also verified:** the new routes are auth-protected by the existing middleware
(`/api/palette` without a cookie → 307), and a bogus ticker is omitted rather
than drawn flat (3 of 4 requested keys returned).

---

## Part 8 — Notes redesign — DONE

**Status (2026-09-23): built, approved row by row, and applied.** The column did
two unrelated jobs, and the fix was to separate them rather than restyle the
field.

The owner approved this reading of the request on 2026-09-23:

> Keep `notes` as the human half, render the factual half instead of storing it,
> hide the notes that are only the instrument's name, and show me a printed dry
> run before rewriting any stored note.

What shipped (Part 25 has the implementation detail): `lib/notes.ts`
(`ledgerSummary` derives the line from the row; `classifyNote` decides
reference-vs-context), the ledger's Note column renders the owner's note when
there is one and the derived line when there is not, and `lib/notes-cleanup.ts`
+ `scripts/notes-cleanup.ts` (`npm run notes:cleanup`) hold the owner's verdicts
and apply them.

**The verdicts, as given on 2026-09-23** (each one is implemented in
`lib/notes-cleanup.ts` and pinned in `tests/notes-cleanup.test.ts` against all 64
stored notes):

- The instrument's name is not a note — including the four the runtime
  classifier will not hide on its own (`PG - Proctor & Gamble`,
  `OV8: Sheng Shiong`, `ES3 - STI ETF`, `ST Engineering`), which the owner
  reviewed one at a time. "Clear them, fix the name in the lookup instead", then
  "no name changes at all": the notes go and the ticker keeps the lookup's
  official name.
- An ordinal or a restated action is not a note: the derived line says what the
  row did **and states the new average cost**, which is what a `Second Buy` note
  was being read for. `Odd Lot` is the exception and survives, because which
  board a Singapore trade used is recorded nowhere else.
- A partial sell's fraction is derived (`Sold 8 of 15`), so a note that only
  restates it goes — the same reasoning retires `Sell Part (60%)`,
  `Partial Exit (60%)` and `Remaining 40%`.
- `Avg down to x10@$263.25` is the average actually **achieved**, not a target
  (the owner's answer to the one question the text itself could not settle), so
  it is derived too and those three notes go.
- DCA notes collapse to one consistent form naming the **allocation month**, read
  from the row's own date, because the month is the part the app cannot derive:
  `DCA · May 2026` … `DCA · Sep 2026`. "Brought forward" is dropped and the two
  old styles (`(MAY DCA: $865)`, `Sept DCA`) become the same thing.
- Stop-loss / take-profit notes stay verbatim, and a later pass should model the
  levels properly.

Applied result: **51 cleared, 8 rewritten, 5 kept** — 13 notes in the column
instead of 64 rows of duplicated names. Reverting is one command
(`npm run notes:cleanup -- --revert notes-backup-<stamp>.json`), against a backup
written before the first row was touched.

---

The original analysis, kept because its measurements are still the reason for
the design:

The `notes` column does two unrelated jobs, and the fix is to separate them,
not to restyle the field.

Measured on the live database (2026-09-22): 64 transactions and **all 64 carry
a note**; 56 of the 64 match the `"<TICKER> - <name>"` reference-data pattern;
26 distinct positions exist. Real examples of what is in the column (these are
instrument names, not secrets): `VOO - Vanguard S&P 500 ETF`, `D05 - DBS`,
`03115 - iShares Core Hang Seng Index ETF`, `B - Second Buy`,
`QQQ - Sell All`. One note misspells *Procter* as
*Proctor* — that typo class is exactly what automation deletes.

The two jobs:

1. **Reference data** — the instrument's name. Part 2 made this redundant:
   `TickerMeta` caches the name per `(region, ticker)` and the UI renders it.
   Retyping it into a note is duplication that can drift from the cache.
2. **Human context** — what the owner was thinking (`B - Second Buy`,
   `QQQ - Sell All`). This is the part worth keeping.

Options, ranked by value per unit of effort:

- **(a) Auto-generate the factual half.** The engine already derives
  `runningQty`, `runningAvgCost` and `transactionValue` for every row
  (`lib/portfolio-engine.ts`, surfaced through `EditableTransactionRow`), so the
  ledger can render a summary with zero typing — e.g.
  `Added 5 @ US$546.00 · avg 546.00 -> 541.20 (-0.9%)`, `Position opened`,
  `Position closed`. It must stay **derived, never stored** (invariant 1); do
  not write it back into `notes`.
- **(b) One-time reference-data cleanup.** Once names render from `TickerMeta`,
  strip the now-redundant `"<TICKER> - <name>"` prefix from the 56 name-style
  notes, keeping any real trailing context. This rewrites real rows, so it needs
  the owner's explicit go-ahead and a printed before/after dry run first.
- **(c) Typed notes.** A small closed set of note kinds plus freeform text, so
  notes become filterable and countable rather than only readable.
- **(d) Position-level journal.** Attach notes to a `(region, ticker)` over time
  instead of to a single ledger row, so "why do I hold this" has one home.
- **Not options:** a second free-text field, or putting fees/allocation into
  notes (see Non-goals).

**Acceptance (once the owner picks):** the chosen option is implemented without
storing derived values; the ledger renders it; and notes that carry human
context remain byte-identical unless option (b) was explicitly approved.

**How (a) and (b) were resolved:** (a) is done as `ledgerSummary` in
`lib/notes.ts` — derived on every render, never written, formatted with
`formatAmount`/`formatQty` from `lib/format.ts` (moved out of
`components/SignedNumber.tsx` so a lib module does not import a component; the
component re-exports them, so call sites are unchanged). (b) is reduced to its
safe half: the reference notes are **hidden**, not deleted, and the rewrite is
gated on the dry run. The classifier is deliberately asymmetric — a note is
hidden only when every meaningful word in it already appears in the cached name
(`isNameOnly`), so an unverifiable note stays visible:

| note | cached name | shown? | why |
|---|---|---|---|
| `VOO - Vanguard S&P 500 ETF` | Vanguard S&P 500 ETF | hidden | the name, nothing else |
| `PLTR: Palantir` | Palantir Technologies Inc. | hidden | every word is in the name |
| `VUG - Vanguard Growth ETF` | Vanguard Morningstar Growth ETF | hidden | still contained |
| `PG - Proctor & Gamble` | The Procter & Gamble Company | **shown** | `Proctor` is a typo — the class automation would erase |
| `OV8: Sheng Shiong` | Sheng Siong Group Ltd | **shown** | misspelled |
| `ES3 - STI ETF` | State Street SPDR Straits Times Index ETF | **shown** | an alias the lookup does not state |
| `ST Engineering` | Singapore Technologies Engineering Ltd | **shown** | unverifiable abbreviation |
| `VT - … ETF (MAY DCA: $865)` | Vanguard Total World Stock ETF | **shown** | says something extra |

Measured on all 64 stored rows (2026-09-23): **25 hidden, 39 kept**, asserted in
`tests/notes.test.ts` against the real texts so a rule change that starts eating
notes fails the suite. The dry run splits the 39 further — **14** only restate
the action (`Sell All`, `Second Buy`, `Odd Lot`), which the derived line now says
better, and **25** carry a level, an amount or a share count that nothing else
stores (`DRAM - 100% Stoploss Exit (62.4 SL, 78 TP)`).

**Not done, deliberately:** the two options below that nobody asked for — typed
notes (c) and a position-level journal (d) — and any rewrite of the stored text.

---

## Part 9 — Concentration & risk analytics — DONE

A risk & concentration panel on the home page: how few names the money sits in,
what the volatility and risk-adjusted return have been, how the holdings move
together, and how the trailing year has changed over time.

What was actually done:

- **`lib/risk.ts`** (new, pure): `concentration` (largest weight, top-5 weight,
  HHI, `effectiveN = 1/HHI`, banded low/moderate/high at the conventional
  0.15/0.25 cut-offs), `annualizedVolatility`, `sharpeRatio`, `largestMove`,
  `correlationMatrix` and `rollingAnnualizedReturn`. No I/O, so each definition
  has one implementation and is testable against known arithmetic.
- **`lib/performance.ts`** now owns the return primitives:
  `portfolioDailyReturns` and `priceReturns` (was `benchmarkDailyReturns`) moved
  there from `lib/benchmarks.ts`, and `alignCloses` moved to `lib/prices.ts` —
  the module that owns `HistoricalCloses`. That keeps the dependency arrows
  pointing out of the risk module rather than through the benchmark one.
- **`lib/concurrency.ts`** (new): `mapWithConcurrency` moved out of
  `lib/sparklines.ts` so the sparkline fetcher and the correlation fetcher share
  one implementation instead of importing each other's module.
- **`components/RiskPanel.tsx`**: concentration bars (gold, per the owner's
  choice) + Positions/Largest/Top 5/Effective N; volatility, Sharpe and
  annualized TWR; the rolling-1Y line; and the largest single day with its share
  of variance. Stats arrive as props computed on the server, so the numbers are
  in the server HTML and can be checked without a browser.
- **`components/CorrelationHeatmap.tsx`** + **`app/api/correlation/route.ts`**:
  an 18×18 matrix fetched on the client (18 symbols is real upstream work, and
  the panel sits far enough down the page that blocking the overview on it would
  be the wrong trade). The route derives the ticker list from the ledger itself
  via `computeLedger` — there is no stored position table to read, and there
  should not be. Pairwise correlation uses **pairwise-complete** overlapping days
  after aligning on the union of dates, because US/SG/HK holidays differ; a flat
  series reports `null` rather than 0 ("no variance" is not "uncorrelated").

**Deliberate deviations from the original scope, and why:**

- The rolling window is its **own chart inside the panel**, not a second series
  on the value chart. The value chart's reading is "what is the portfolio
  worth"; a rolling return has a different unit and axis, and overlaying it made
  both harder to read.
- Everything is computed over **all history**, not the chart range picker.
  Volatility and Sharpe are estimates; a one-month window makes them swing
  without meaning anything. The rolling line is what shows movement over time
  while keeping the estimate's sample long, and the panel says so in its header.
- Volatility annualizes by **sqrt(365)**, not sqrt(252): `DailySnapshot` rows are
  calendar-daily while markets trade ~252 days a year, so weekend and holiday
  observations are genuine zeros in the series. sqrt(365) is exactly what undoes
  that dilution; measured on real data, 403 of 569 days have a non-zero return,
  i.e. the expected 5/7. The basis is a documented parameter.
- Risk-free rate is a **stated constant** (3.5%) shown beside the Sharpe ratio,
  not a fetched rate — the number is an assumption and is labelled as one.

**Verified on the real ledger** (02 Mar 2025 – 22 Sep 2026, 570 snapshots): HHI
14 of 100 (diversified), largest 30.8% (D05), top 5 67.5%, effective N 7.0,
volatility 14.1%, Sharpe 0.40, annualized TWR +9.19%, rolling 1Y now +18.2%
(range 0.0% to 24.1%), 18×18 correlation over 131 trading days. Sharpe
cross-checks against the hero: `0.40 × 0.141 + 0.035 = 0.0914`, i.e. the +9.19%
TWR. `/api/correlation` without the session cookie returns 307, so the new route
is behind the same middleware as everything else.

**Data-quality finding — not a code bug, and deliberately not filtered:** the
`DailySnapshot` for **2025-03-05** is ~S$1,150 low (10,835.78 → 9,753.82, cost
basis unchanged, three days after inception). That single day carries **32.4% of
the portfolio's total variance**: volatility 14.11% vs 11.61% without it, Sharpe
0.38 vs 0.47, annualized TWR 9.19% vs 16.82%. It is really in the stored data
(not the −100% clamp in `portfolioDailyReturns`), and the app's headline TWR
already includes it, so the panel **reports** it — largest single day plus its
variance share — instead of quietly dropping outliers, which would make
volatility inconsistent with TWR and hide the error. Fixing it means correcting
the stored snapshot.

Original scope and acceptance criteria (kept for reference):

Pure arithmetic on data the app already loads; no new provider. Add a
risk/composition panel on the home page.

- **Concentration:** largest-position weight, top-5 weight, and **HHI**
  (`sum of w_i^2`) with its reciprocal shown as "effective number of holdings".
  With ~18 positions and over 60% in one region, this is genuinely informative.
- **Volatility:** annualized standard deviation of daily portfolio returns —
  reuse Part 4's `filterByRange` / `PerfPoint` series in `lib/performance.ts`,
  do not re-derive the return series.
- **Sharpe ratio:** `(annualized return - risk-free) / volatility`, with the
  risk-free assumption **displayed in the UI**, and a guard when volatility is
  ~0. Risk-adjusted return is the modern standard over raw return.
- **Correlation matrix:** pairwise correlation of held tickers from
  `fetchHistoricalCloses` — batch the calls (the backfill script's 500ms
  spacing), never one request per page load.
- **Rolling windows:** the residual of the research's "rolling windows" item —
  a rolling 1Y annualized series on the value chart. Part 4 already delivered
  the fixed ranges and the calendar-year table.

**Acceptance:** every number derives from existing data; the risk-free rate is
shown beside Sharpe; all price-history work is batched and cached with no
unbounded Yahoo calls per page load; unit tests pin HHI and Sharpe on known
inputs.

---

## Part 10 — Exposure analytics — DONE

A `/exposure` page (plus a nav link and a command-palette entry) answering
"what am I exposed to", as opposed to "what is it worth".

What was actually done:

- **Migration `20260922140000_add_ticker_sector`** adds `TickerMeta.sector`
  (`TEXT`, nullable). Generated with `prisma migrate diff` and applied with
  `migrate deploy` (invariant 6 — `migrate dev` refuses in a non-interactive
  shell). Nullable on purpose: no free data source classifies these
  instruments, so an untagged holding must read as UNKNOWN and never silently
  become an "Other" bucket that overstates how much is known.
- **`lib/exposure.ts`** (new, pure): `groupExposure` with `sectorExposure` and
  `currencyExposure` over it, and `toExposureLines`. 16 tests in
  `tests/exposure.test.ts`. `fxAttribution` and `sgdCostPerShare` were part of
  this module at the time and were **removed in 14b** — see that section, and
  the note below, for why.
- **`lib/fx-history.ts`** (new): daily SGD-per-unit closes for SGD/USD/HKD from
  the same Yahoo chart endpoint the app already uses, shaped ONCE into "SGD per
  one unit" (Yahoo quotes units of foreign currency per USD — the opposite
  direction, and getting it backwards is off by 1.3–7.8× while still looking
  plausible). The HKD cross rate is derived, not fetched. 15-minute in-process
  cache plus single-flight on top of Next's 1-hour fetch cache, so the cost is
  two upstream calls an hour regardless of page views.
- **`sgdPerUnit`** added to `lib/fx.ts`: the single place the rate direction is
  converted, instead of dividing by a rate at each call site.
- **Cost basis in SGD at PURCHASE-date rates** (`sgdCostPerShare` feeding
  `computeLedger()` a ledger whose Buy prices are pre-converted) and the **P&L
  split** it existed to serve (`localPlSgd` = the price part the holdings page
  already shows, `fxPlSgd = qty × avgCost × (fxNow − fxAtCost)` = the currency
  part) are **both REMOVED in 14b**. They were correct arithmetic built on the
  wrong premise: a per-holding currency gain measured from the PURCHASE date.
  Kept in this paragraph only so the history is not rewritten — neither symbol
  is exported from `lib/exposure.ts` any more, and no test references either.
- **UI:** `components/ExposureDonut.tsx` (recharts donut + a legend carrying
  the exact value and share of every slice, since a donut is a shape you have to
  estimate off), `components/SectorTagEditor.tsx` (one row per instrument, biggest
  holding first, Enter saves, Escape reverts, autocomplete from tags already in
  use so a second position can reuse a tag without retyping — and no pre-canned
  sector list, because guessing is exactly what this design refuses to do).
- **`app/api/ticker-meta/route.ts` PATCH is now field-presence aware.** It
  previously set `name` unconditionally, so a sector-only edit would have
  cleared a hand-corrected name as a side effect. Verified: a sector write leaves
  `nameOverridden` false and the name intact.

**Verified on the real ledger** (18 open positions, S$61,840.88):

- Sector donut sums to 100% — with nothing tagged yet it reads **Unclassified
  100.0%** and says why, which is the honest empty state rather than a fabricated
  breakdown. Tagging D05 as "Banks" in the live page moved it to **Banks 30.8% +
  Unclassified 69.2%** with coverage "1 of 18 tagged", and the header announcing
  "31% of value is sector-tagged".
- Currency exposure: **USD 61.7%, SGD 36.9%, HKD 1.4%** — i.e. only ~a third of
  the holdings is in the reporting currency.
- FX attribution on the same render: value **S$61,840.88** − cost at purchase FX
  **S$54,216.94** = **S$7,623.93** total P&L, split into **+S$7,809.02 from prices
  and −S$185.09 from currency**. Both identities held exactly, on screen and in
  the rendered HTML: value − cost equals the total, and price + FX equals the
  total. Currency was **−2.4%** of the SGD P&L. **This whole panel is REMOVED in
  14b** — the arithmetic was sound and is recorded here as the measurement that
  prompted the removal, not as a description of what `/exposure` shows today.

**Bug found and fixed while verifying:** the page's two totals disagreed by S$21
(S$61,827.94 vs S$61,806.63) on first render. Cause: `getOpenPositionsFor()`
fetched its OWN FX rates while the page fetched a second set, and two FX quotes
taken moments apart differ in the fourth decimal. `getOpenPositionsFor()` now
accepts an optional `rates` argument and the page fetches once and passes it in,
so one render only ever holds one FX snapshot. Re-measured: both totals identical
across three consecutive renders.

Original scope (kept for reference):

- **Sector / asset-class exposure.** One manual tag per instrument
  (`DRAM -> Semiconductors`, `D05 -> Banks`, `VOO -> US Equity Index`) stored on
  `TickerMeta` (Part 2). There is currently **no** `sector`/`assetClass` field
  anywhere in the schema, so this needs a migration. Manual tagging captures
  most of the value without a paid look-through provider; it surfaces an
  exposure donut and concentration-by-sector. `TickerMeta` is a cache, so an
  unset tag means "unknown" — never silently "Other".
- **Currency exposure + FX attribution.** Base is SGD while holdings are USD,
  SGD and HKD, so part of the SGD P&L is currency movement. Split SGD P&L into
  **local return** and **FX return** so the currency slice stops hiding inside
  the total. The ETF-overlap this exposes (QQQ + QQQM + VUG) is worth showing,
  not silently deduplicating.

**Acceptance:** the exposure donut either sums to 100% of value or is
labelled "unclassified"; FX attribution reconciles with total P&L to the cent.

---

## Part 11 — Contribution attribution — DONE

A `/attribution` page (nav + command-palette entry) answering "which holding,
and which period, did this".

What was actually done:

- **`lib/attribution.ts`** (new, pure): `contributionAttribution` builds a
  position × month grid; `holdingsValueOn`, `monthEnd`, `monthKeysBetween`,
  `closeOn`, `rangeIndices`, `selectColumns` and `groupByQuarter` are the pieces.
  **30 tests** in `tests/attribution.test.ts`.
- **`lib/attribution-data.ts`** (new): historical closes for every ticker ever
  traded (26 here) with a 15-minute cache and 4-way bounded concurrency.
- **`prisma/backfill-snapshots.ts` / `lib/snapshots.ts`: `positionsAsOf` moved
  to `lib/portfolio-engine.ts`.** It is pure ledger replay with no DB, no FX and
  no prices, and keeping it beside the engine is what lets
  `lib/attribution.ts` avoid importing a DB-backed module at all.
- **`rangeStartMs()` extracted from `filterByRange`** in `lib/performance.ts`, so
  the daily charts and the monthly grid share one definition of what "3M" means
  instead of two that can drift.
- New **`components/ContributionAttribution.tsx`**: the range picker, a
  Month/Quarter toggle, the headline gain, biggest contributors as gold bars, and
  the full grid with a sticky instrument column and a totals row.

**The definition:** `contribution = V(t) − V(t−1) − netCash`, where netCash is
what was PAID for shares bought in the period less what was received for shares
sold. Money moved into a position is therefore not a contribution — buying
S$1,000 of VOO that is still worth S$1,000 contributes exactly 0. Summed over
every position the value terms telescope and the cash terms cancel, leaving the
portfolio's gain; **a test pins that the monthly columns sum to the same total
as one single period**, so slicing the window redistributes rather than
reassigns. Closed positions stay in the grid, because their realized gain really
happened.

**Verified on the real ledger** (26 instruments ever traded, 02 Mar 2025 –
22 Sep 2026, 19 months): portfolio gain **S$10,795.45**, with **21 positions
contributing and 5 subtracting**. Top contributors D05 +6,608.80, VOO
+1,076.68, B +829.58, NOW +764.07, QQQ +643.06, ES3 +480.20.

**Reconciliation, measured in the rendered page rather than asserted:** on the
1Y window the column totals read +751.46, +813.98, +17.71, +460.76, +343.19,
−613.37, −1,794.51, +1,541.68, +3,937.16, −926.26, +1,476.10, +3,977.46,
+545.97 and add to exactly the displayed **+10,531.33**; switching to quarters
regroups them to +751.46, +1,292.45, −2,064.69, +4,552.58, +5,999.53 with the
same grand total, and D05's row (126 + 1,042 + 108 + 1,700 + 2,598.80) sums to
its own 5,574.80. Every row and column adds up.

The original scope and acceptance criteria (kept for reference):

"Which holding, and which period, drove this result" — the question a single
return number cannot answer. Per-position contribution to the selected range's
change in value, plus the same split by month/quarter, reconciled against the
portfolio total. Depends on Part 4's range selector.

**Acceptance:** per-position contributions sum to the portfolio change for the
selected range; neither fees nor target allocation appear (Non-goals).

---

## Part 12 — Responsive & loading polish

Two measured gaps, independent of each other:

- **Mobile tables.** `.ledger-table` forces `min-w-[720px]` and `.table-scroll`
  scrolls both axes, which is right on desktop but makes the ledger a sideways
  scroll on a phone. Options: collapse low-value columns under `md`, stack each
  row into a card, or a per-row overflow menu. The sticky `<thead>` depends on
  `.table-scroll` owning both axes — do not break that (see the comment in
  `app/globals.css`).
- **Skeletons.** Only `app/holdings/loading.tsx` exists, so `/`, `/outlay`,
  `/transactions`, `/completed-trades`, `/watchlist` and `/cash` jump on
  navigation. Add an ink-toned skeleton matching each page's layout.

Already done, so drop it from the research list: **sticky table headers**
(`.ledger-table th` is already `sticky top-0` in `app/globals.css`), **range
selectors** (Part 4), and the **gold-as-data decision** (owner prefers gold).

**Acceptance:** no horizontal page scroll at 390px width; every dynamic route
has a `loading.tsx`; any new animation honours `prefers-reduced-motion`.

### Part 12 — DONE (2026-09-22)

**The nav was the real cause of horizontal page overflow.** At 390px the
un-wrappable `<ul>` of eight links alone measured ~675px, so the document was
~995px wide on a ~340px screen. It now collapses into a disclosure panel below
`lg` (not `md`: the row plus brand, palette chip and log-out needs ~880px to sit
on one line, so `md` would have overflowed the 768px viewport it claimed to
support). Measured slack at the switch: links end 804px, chip starts 870px at a
1031px viewport.

**A second overflow came from the headline stat rows**, found only after
re-measuring *post-load* (an earlier measurement read the loading skeleton and
falsely reported clean): `.flex.gap-10` with two `text-3xl` figures measured
**504px on a 356px viewport**. Now a shared `.stat-row` / `.stat-label` /
`.stat-value` in `app/globals.css` — the row wraps, the number steps down to
`text-2xl` below `sm`. Applied to `PositionsTable`, `ContributionAttribution`,
`completed-trades` and the trade-history modal.

**Column collapsing** (the plan's first option) below `lg`, chosen so nothing
computed can be lost: positions drop `Held`, `30d` and `Portfolio %`; the ledger
drops `Running qty` and `Txn value`; the watchlist drops `Notes` below `sm` and
now fits its box exactly (290/290 vs 384/290, which is what had been pushing the
remove button off-screen — the old `panel overflow-hidden` clipped it with no
way to scroll to it, a real bug, now `overflow-x-auto`).

**Skeletons:** `app/loading.tsx` plus seven new route-level files
(`outlay`, `transactions`, `completed-trades`, `watchlist`, `holdings/cash`,
`exposure`, `attribution`), all built from `components/Skeleton.tsx`, which
reuses the real `.ledger-table` / `.table-scroll` classes so the table keeps its
column widths through the swap. `app/holdings/loading.tsx` replaced its single
line of pulsing text. Every animation carries `motion-reduce:animate-none`, and
each route announces itself through a `role="status"` line, because `aria-hidden`
visual skeletons would otherwise leave screen-reader users on a page that
silently does nothing.

**Two incidental repairs**, both outside the plan's scope but in the way of
"lint is clean":

- `package.json`'s `lint` script was `next lint`, which **Next 16 removed** — it
  failed with `Invalid project directory provided, no such directory: ...\lint`
  and, because the outputs were piped, that failure read as a pass. It is now
  `eslint .`.
- `prisma/backfill-snapshots.ts` imported `computeLedger`, `convertCurrency` and
  `dayKey` without using them (pre-existing at `1d8f82f`, not from this pass).

**Verified in the running app at 356 / 701 / 1004 / 1031 / 1095px** across all
eight routes: `documentElement.scrollWidth === clientWidth` (no page-level
scroll), zero offenders outside their own scroll containers, and the mobile menu
opens, highlights the current route, and closes itself on navigation.

---

## Part 13 — Range-selector transitions + load-time optimisation

Owner request, two halves:

- **Transitions.** Changing a time-range selection should animate rather than
  snap: the portfolio value chart, the benchmark window, the stakeholder picker
  and the month/quarter toggle. Existing range state already re-renders these,
  so this is presentation only — and each animation must honour
  `prefers-reduced-motion`.
- **Load times.** Owner reports slow pages. Evidence from the dev log rather
  than guesswork: `GET /` **18.1s** and `GET /holdings/us` **9.1s**, with
  `application-code` accounting for essentially all of it (Next itself is tens
  of milliseconds per request) — so it is this app's own data fetching, not the
  preview being open and not the framework.

**Acceptance:** the same routes render substantially faster with the same
numbers, and every range/period control animates on change with a
reduced-motion path.

### Part 13 — DONE (2026-09-22)

**The slow pages had nothing to do with the preview.** The dev server logs its
own breakdown, and it put the time in application code, not in Next: `GET /`
**18.1s** and `GET /holdings/us` **9.1s**, against `next.js: 23ms` per request.
A throwaway probe outside the framework then split that time up and found the
cause was not where anyone was looking — the quotes everyone suspected came
back in **118ms for all 18 tickers**, while the database round trips were the
cost:

```
read 64 transactions             3879ms
SELECT 1 (reuse an open conn)     400-540ms
```

Two things followed from that.

**1. `ensureTickerMeta()` was doing 36 round trips per render.** It looped over
every open position and ran a `findUnique` AND an `upsert` for each. At ~350ms
a query against the Supabase pooler in Sydney that is ~13s of the ~18s page,
on every holdings/exposure/overview render, to restate reference data that had
not changed. It now reads the table once, compares, and writes only what
actually differs — `fetchedAt` is deliberately excluded from that comparison,
because treating "last checked" as a change is exactly what made every render a
write. The caller reads the same rows once and shares them for names too.
Related: the dashboard was issuing four separate reads of `transaction` per
load, and `getOpenPositionsFor()` now accepts rows the caller already has (the
same pattern it already used for FX rates).

**2. Parallel queries were 2× slower than sequential ones.** Measured, five warm
queries each way:

| pool | mode | per query |
|---|---|---|
| `connection_limit=5` | parallel | **723ms** |
| `connection_limit=5` | sequential | 389ms |
| `connection_limit=1` | parallel | **263ms** |

Opening a connection to that pooler costs ~2.4-3.5s, so every extra pooled
connection costs more than the parallelism buys. The app fires its reads
through `Promise.all`, which with a five-connection pool opened several at once
— and under concurrent loads the pool starved outright: **31 `P2024` "Timed out
fetching a new connection" failures** in the dev log, whose 10s timeout was
itself part of the reported slowness. `lib/prisma.ts` now pins the pool to one
connection (`PRISMA_CONNECTION_LIMIT` overrides) with a 30s queue timeout.

**Also:** `recordTodaySnapshot()` ran three reads, nineteen Yahoo historical
fetches and an upsert on *every* dashboard load to keep today's dot current. It
now self-throttles to once per five minutes (in-process, stamps only on
success), which keeps the intent and drops the cost.

| route | before | after |
|---|---|---|
| `/` | 18.1s | **1.4-2.3s** |
| `/holdings/us` | 9.1s | **0.95s** |
| `/transactions` | 1.5s | 1.8s |
| `/exposure`, `/attribution`, `/outlay` | — | 1.5-2.0s |

Pool timeouts after the change: **0**.

**Transitions, corrected after owner feedback.** The first attempt made every
selection a crossfade: a keyed `.swap-in` container remounted the charts and
Recharts' own animation was switched off so the two couldn't compete. The owner
rejected that for the time-period selector specifically — remounting restarts a
chart from an empty axis, whereas what reads as smooth is *the same chart
narrowing its window*. So the two halves are now split by what is actually
changing:

- **Charts: the chart animates itself.** The range-driven charts are no longer
  keyed or crossfaded, so they stay mounted and Recharts tweens the line to its
  new shape (`isAnimationActive` on the value, drawdown and benchmark series —
  the benchmark pair previously snapped, so a window change animated two charts
  and not the third). Recharts' default timing is deliberately left alone: it is
  the behaviour the owner asked to have back.
- **The selected pill: it slides.** A new `components/SegmentedControl.tsx`
  replaces the four hand-rolled copies of the same markup (time range,
  benchmark index, stakeholder, period grouping). One absolutely positioned
  gold pill moves with a `transform` transition, so the motion is
  compositor-only and reads as the selection travelling rather than two
  repaints. It is measured, not assumed: labels differ in width and the
  stakeholder row wraps on narrow screens, so the offset carries a vertical
  component too (verified moving diagonally to `(46.3, 25.9)` on a wrapped
  row). Until the first measurement lands the active button paints its own
  background, and afterwards the pill alone owns the colour — leaving both on
  would show two gold rectangles mid-slide.
- **Tables and stats: still `.swap-in`.** The attribution summary and table,
  and the benchmark statistics, are not charts, so a 240ms fade + rise is the
  right transition there.

Reduced motion is honoured in both paths: `motion-reduce:transition-none` on
the pill and `@media (prefers-reduced-motion: reduce) { .swap-in { animation:
 none } }` in the stylesheet, verified present in the built CSS.

**Verified in the browser, not asserted:** the pill's transform walked
77.1 → 83.7 → 121.5 over 200ms on the range picker and landed with no offset
(dx/dy/dw all 0); the value chart's path length went 46233 (All) → 29677
(mid-flight, 250ms in) → 29530 (settled at 1Y), which is a tween and not a
snap; the stakeholder picker moved the pill diagonally and left the active
button with no background of its own; the quarter toggle re-rendered to
"Portfolio gain over 7 quarters" with both the summary and the table fading.

**Left on the table:** the remaining 1-2s per route is ~4-6 sequential round
trips at ~300ms against a pooler on the other side of the world. A
short-TTL cross-request cache on the ledger read would remove most of it, but
it needs invalidation on every write path (transactions, contributions, cash,
ticker meta) and a stale read after an edit is a far worse bug than a slow
page — so it is deliberately NOT done here. The measuring probe
(`tmp-perf-probe.ts`) was deleted after use.

## Part 14 — The owner's revised ledger, and the deposit schedule

The owner supplied an updated deposit/exchange ledger (the 2026-09-22 revision)
and asked for three things: vet it, reconcile the database to it, and answer
"are we up to schedule?". Two answers were approved up front:
currency is reported in the places it is real (14b), and deposit timing is
tracked with a payment date plus a deliberately quiet late flag (14a).

### Vetting the sheet

**Every one of the 25 conversion rows has exactly one debit and one credit.**
Checked structurally — the only row with more than one debit column is row 2,
the header. No accidental double-debit anywhere.

**One rate was genuinely wrong: row 11, 2025-08-13.** The sheet records
S$2,400 debited for HK$18,797.42, which implies **7.83 HKD per SGD** against a
day's cross rate of **6.13** — **+27.7%**, which no spread explains. The HKD
figure only prices correctly as a **US$2,400** debit: 7.8323 is 0.22% below
that day's USD mid, the same direction and size as its neighbours (row 12
+0.04%, row 13 -0.20%). The row is imported as **USD 2,400 -> HKD 18,797.42**
and is the ONE row corrected rather than transcribed; the correction is an
explicit table in the importer so it can never be mistaken for a faithful read.
The sheet cell itself should be fixed by the owner.

**The other 24 rows are clean:** every one within **0.75%** of the day's mid,
22 of them slightly below it with the same sign every time — a broker spread,
which is what real fills look like. One item is for the owner's eyes rather
than an error: 2025-10-13 carries S$1,600 -> HK$9,549.63 and HK$10,281.30 ->
S$1,708.74 the same day. Both prices are right for that day and the amounts do
not mirror each other as a duplicated entry would, so it reads as a real sweep
back to SGD.

### What the database now holds

The ledger was stored as a per-person, per-month model, and the revision changed
four things plus the exchange log:

| change | why |
|---|---|
| deleted the 5 scheduled `MAR (2025)` rows (-S$2,200) | March 2025 is the Initial's month, not a scheduled one — exactly the S$2,200 the owner said the total comes down by |
| Keng `APR (2025)` 4,400 -> 500, with S$3,900 split out as its own row | the sheet marks it "add inline", and April's schedule is 500. The owner later moved that row's attribution to **April 2025** (it was paid 14 Apr, and March belongs to the Initial), so April reads 6,100 and March holds the Initial alone |
| Josh `JAN (2026)` 1,000 -> 500, `MAR (2026)` 500 -> 1,000 | same, for his March top-up |
| Keng `Additional` re-dated 2026-03-15 -> 2026-05-09 | the sheet keeps it as a separate row and dates it |
| 25 `CashExchange` rows imported (table was empty) | the audit trail the ledger was always meant to provide |

**Cash balances were not touched** (invariant 2, and `CashExchange` feeds only
the activity feed — verified by grepping every reference: the cash page's recent
list and the home page's three-item feed. No money math reads it).

Result: **96 contributions, S$54,697.00** — the sheet's total exactly. The month
grid reads **18 consecutive scheduled months, every one at exactly S$2,200**,
plus the labelled additions (Initial 8,752 in March; Keng's 3,900 in April, which
is where it was paid; Josh's 500 inside MAR-2026's 2,700; Keng's 1,945).

### The snapshot consequence, and why `npm run backfill` was NOT used

`DailySnapshot.costBasisSgd` is derived from contributions (both writers call
`outlayAsOf()`), so changing the ledger made every historical row's outlay stale
— the chart's dashed outlay line would have disagreed with the headline.

The repo's own `prisma/backfill-snapshots.ts` says it is safe to run "after
correcting the ledger", but it also **re-prices every historical day and passes
`fetchFxRates()` — TODAY's FX — into `dayValue` for those past dates**. Running
it would have restated 18 months of foreign holdings by the SGD's drift since,
to fix one field. Instead `costBasisSgd` alone was recomputed in a single
statement.

Before touching anything, all **570** stored snapshots were checked against the
OLD ledger's outlay: **0 mismatches**, so the stored series was internally
consistent and the correction would be a pure propagation. After the recompute:
**0 mismatches**, today's row 56,897 -> **54,697**. (The fix used
`UPDATE ... FROM (SELECT SUM(...) ...)`, not 570 round trips; the migration-style
one-off scripts were deleted after use.)

### 14a — the deposit schedule

**`Contribution.paidOn` (nullable).** The attribution date (`date`, always the
month's first day) is what the outlay curve and pivot need and cannot double as
the payment date: a month funded two months late has to keep belonging to its
own month. Migration `20260922150000_add_contribution_paid_on`, applied with
`npx prisma migrate deploy` (deploy, not dev — dev wants a shadow database this
pooled connection cannot create). Backfilled for all 96 rows from the sheet's
remarks: the lumps are transcribed as they were paid, so "May and June" carries
5 Jun on both months and Josh's March row (which also holds his 9 May top-up)
carries 14 May, when that month was complete.

**`lib/schedule.ts` is pure** and answers exactly one question: is a scheduled
month's money in on time? Late means the money landed after the attributed month
closed; paying EARLY is never late; an unknown date is unmeasured, not on time
(`measuredMonths` is counted separately from the total). A month's lump is
complete when its LAST row lands, so a label's date is the max across its rows.
Non-month labels (`Initial Investment`, `Additional`, `Additional (MAR 2025)`)
never carry a verdict — they have no month to be late against. 11 tests cover
month-end arithmetic, leap February, a December year-end, early payment, unknown
dates, the last-row rule and the worst-offender summary.

**The UI is deliberately quiet** (owner's explicit constraint, refined after
feedback): a small dim clock icon beside the month — no text, no colour, no
badge — whose tooltip reads "Late deposit / MAR (2026) allocation deposited
14 May 26 — 44 days after the month closed", plus ONE dim caption line under the
section heading. A late deposit is a note rather than a problem, because money
sitting in the account earns nothing. Measured live: **7 of 18** scheduled
months arrived after the month closed, worst `MAR (2026)` at **44 days**; the
seven are MAY 2025 (5), JUL 2025 (22), DEC 2025 (29), FEB 2026 (39), MAR 2026
(44), APR 2026 (26), MAY 2026 (11).

The payment date is settable in three places, so the feature is maintainable
rather than write-once: the deposit form (both tabs, defaulting to today),
`POST /api/contributions`, and the pivot's LABEL cell — clicking a month opens a
one-field editor that PATCHes every row under that label, because a month's lump
arrives as one payment split across stakeholders. `PATCH` now accepts `paidOn`
alone (`"paidOn" in body` so an explicit null means "unknown", which is
different from not sending it) and a payment-date change never touches cash — it
changes WHEN money arrived, not how much. Verified end-to-end: setting MAY 2026
to an on-time date moved the marker count 7 -> 6 and the caption with it, wrote
the same date to all five rows, and the restore put both back; the CSV export
gained a `paidOn` column and `prisma/seed.ts` was corrected to match, so a fresh
install reproduces the corrected ledger rather than the old one.

### The Part 13 regression this batch also fixes

Part 13 broke the Vercel preview build, and nothing local could see it: the
four local checks stayed green. The evidence was in the commit statuses —
**Vercel succeeded on 80296c5 (Part 12) and failed on every commit after it**
(d1a6330, da7a5bd, e710f49).

The cause is the pool override Part 13 added, which always passed an explicit
URL:

```
new PrismaClient({ datasources: { db: { url: datasourceUrl() } } })
```

With `DATABASE_URL` unset, `datasourceUrl()` returns `undefined`, and Prisma
rejects an explicit `undefined` for a datasource — `Invalid value undefined for
datasource "db" provided to PrismaClient constructor` — where a bare
`new PrismaClient()` simply resolves the variable later, at connect time. That
difference is fatal at BUILD time, because `next build` imports every route
module to collect metadata, so any build machine without `DATABASE_URL` (a
Vercel preview, in this case) fails the build outright.

The override is now additive: no URL, no override. Verified three ways — the
explicit-undefined form and the default form constructed in isolation (throws /
does not throw), a build with `DATABASE_URL` emptied now succeeding, and Vercel
itself going green again on `133bcaa`. **The lesson worth keeping: a local green
build says nothing about a build environment without your `.env`.**### 14b — currency reporting: the purchase-FX split is REMOVED (done)

The owner's model, in their words: everyone bulk-deposits, the money sits in a
three-currency margin account, and stocks are bought with cash **already
exchanged**. The old `/exposure` FX table measured the opposite thing — it
costed each position at its PURCHASE date's rate and called the difference a
currency gain. The owner asked the direct question ("since exchange is done
before the purchase, do the purchase FX still apply?") and the answer is no,
because the rate that funded a holding is a conversion the `CashExchange`
ledger records, not the day the trade happened.

What was removed (all of it, rather than left dark on the page):

- `components/FxAttributionTable.tsx` — deleted.
- `lib/exposure.ts`: `fxAttribution`, `sgdCostPerShare` and the
  `MAX_FX_*` / cost-spread types — removed, so the module is now exactly the two
  groupings the page shows (`sectorExposure`, `currencyExposure`).
- `lib/fx-history.ts`: `rateSeriesSpan` removed (it only served the panel's
  coverage caption, which is where the owner's "FX rates from 21 Sep 21" came
  from). `buildSgdRateSeries` and `sgdRateOn` stay — `/attribution` prices each
  trade at its OWN day's rate with them. The file header now says so instead of
  pointing at the exposure view.
- `tests/exposure.test.ts`: the 14 FX-split tests deleted (30 -> 16 tests; full
  suite 230 -> 216). The historical-rate tests stay, because `/attribution` still
  depends on that behaviour.
- `app/exposure/page.tsx`: the section, its caption and the now-unneeded
  `getSgdRateSeries()` fetch and `Promise.all` entry are gone; the page's own
  header comment records what used to be there and why.

The sentence that replaces it points at where currency IS real: the currency
donut notes that the rate which matters is the one the funding cash was
**converted** at, "which your deposit ledger records, not the day the shares
were bought". Nothing on `/exposure` claims a per-holding FX gain any more, and
the portfolio total is unchanged — the SGD value necessarily keeps whatever FX
is embedded in today's prices; only the attribution changed.

**Still open from this workstream** (specified, deliberately not built yet — the
owner has not asked for either panel):

1. **Realized FX on conversions.** The 25 `CashExchange` rows now exist, so each
   conversion's executed rate against that day's mid is computable — measured
   across the file at 0.14-0.74% below mid, which is the spread paid, and the one
   same-day round trip would show its own loss.
2. **Unrealized FX on foreign cash.** US$3,262.68 and HK$0.23 are a live rate
   position, and the only place currency exposure is unambiguous.

**Acceptance for what is now done:** no per-holding row claims an FX gain, no
symbol removed above is referenced anywhere (checked with a repo-wide grep),
`tsc` / `eslint` / `npm test` (216) / `npm run build` all pass, and `/exposure`
still renders its two donuts with the same totals as before the removal.

---

## Part 15 — the five objects (DONE)

**The diagnosis, measured.** The nav was eight entries in the order the app was
built (Home, Outlay, Transactions, Holdings, Exposure, Attribution, Watchlist,
Completed Trades) — a list of *reports*, four of which were views of the same
positions and the same money, each holding a top-level slot away from the object
it described. The dashboard had grown to **12 panels, 3.3 screens and 448
rendered numeric values**, and only 4 of its 12 panels carried a heading, so its
structure was invisible.

**The rule now:** each nav entry is something the owner HAS.

| Object | Tabs / lenses |
|---|---|
| Today `/` | the dashboard, rebuilt in Part 17 |
| Positions `/positions` | US · SG · HK · **Exposure** · Trades |
| Performance `/performance` | Returns & risk · **Attribution** · Realized |
| Money `/money` | Deposits · Cash |
| Watchlist `/watchlist` | unchanged |

**Moves were `git mv`, not rewrites**, so history follows the files. Cash moved
from Holdings to Money: it is not a position and never fed a holdings figure,
and every page that had to say "holdings only, cash excluded" was working around
where it used to live.

**Redirection lives in `next.config.js`, not in stub pages.** Only the config
can forward a path SUFFIX and the query string: `/holdings/us?ticker=D05` has to
arrive at `/positions/us?ticker=D05`, which a redirect page cannot do without
hand-parsing the query. Verified with real requests (307s):

```
/holdings              -> /positions/us
/holdings/us?ticker=X  -> /positions/us?ticker=X
/holdings/cash         -> /money/cash
/exposure              -> /positions/exposure
/attribution           -> /performance/attribution
/outlay                -> /money
/transactions?add=1    -> /positions/trades?add=1
/completed-trades      -> /performance/realized
```

**Gotcha worth keeping:** `/holdings/cash` had to be listed BEFORE
`/holdings/:path*`, because Next matches these top to bottom and the wildcard
would otherwise send cash to a `/positions/cash` that does not exist. That bug
was live for one build and caught by requesting every old path, not by reading
the config.

**One `SectionTabs` component** replaces the sub-nav that used to exist only
inside Holdings, and it marks active by the LONGEST matching href: with nesting,
the naive prefix rule lights up the section's own tab while the reader is inside
a lens (`/performance/attribution` matches both `/performance` and
`/performance/attribution`).

---

## Part 16 — accounts (DONE)

**Why.** One shared password answers "may this person in" and nothing else — it
carries no identity, so anything that needs to remember something PER PERSON had
nowhere to keep it. The first consumer is the dashboard's "since you last
looked" line.

**Schema:** `User { id, username @unique, passwordHash, createdAt, lastSeenAt }`,
migration `20260922210000_add_users`, applied with `npx prisma migrate deploy`.
`username` is stored already normalised (lowercased, trimmed) so one person
cannot end up with two accounts by capitalising their own name differently.

**Two kinds of session, one cookie**, and the gate still works:

| | shape | identity |
|---|---|---|
| gate | `sha256(SITE_PASSWORD)` | none — everyone is the same visitor |
| account | `username.issuedAt.HMAC-style hash` | who is signed in |

Middleware accepts either, so adding accounts could never lock the owner out of
their own dashboard, and with zero accounts created the app behaves exactly as
before. Signing secret is `AUTH_SECRET ?? SITE_PASSWORD`; with neither set the
app reports "protection isn't set up" rather than locking anyone out, as it
always has.

**The edge/server split is load-bearing:** `middleware.ts` runs on the Edge
runtime, which has no `node:crypto`. So token parsing (WebCrypto SHA-256) lives
in `lib/auth.ts`, password hashing (scrypt, per-user salt, parameters stored IN
the hash so the cost can be raised later without invalidating anything) lives in
`lib/password.ts`, and resolving a token to a person (`lib/session.ts`, which
needs Prisma) is server-only. 13 tests cover normalisation, hashing and token
verification, including the two forgery shapes that matter: a valid signature
with a swapped username, and a session signed by another deployment's secret.

**Creating an account:** `npm run user:add` (or `npm run user:add -- keng`),
which prompts for a password with the terminal's echo OFF and never prints it,
never takes it as an argument (arguments land in shell history and the process
list) and stores only the hash. **Part 19 added the same thing in the browser**
at `/accounts`; the CLI is now the fallback for when there is no account and no
browser at hand, and both call the same two rules (`normalizeUsername`,
`validatePassword`) so they cannot drift.

**Verified end to end** with a temporary account, created and then deleted,
whose password was generated randomly and written only to a temp file outside
the repo:

- `POST /api/login {username, password}` -> **200 `{"ok":true,"username":"…"}`**
  with a session cookie set; a wrong password -> **401**.
- `GET /` with that cookie -> the dashboard renders **"signed in as …"**.
- `lastSeenAt` is seeded by sign-in; with it forced back two days, the dashboard
  read **"since your last visit on 20 Sep 26"** and the stored value then moved
  to ~now, i.e. the throttled touch fired exactly once.
- After deleting the account, the visit degrades to the no-identity fallback
  rather than erroring.

**Honest gap:** the interactive prompt itself (raw-mode keystroke handling) is
the one part a non-interactive shell cannot drive, so it is covered by reading
it rather than by running it. Everything it calls is tested.

**Deliberately NOT built:** per-account scoping. Every account sees the whole
dashboard — the owner chose identity, not access control — so no page gained a
permission check, and `User` carries no link to a `Contributor`.

---

## Part 17 — Today (DONE)

The dashboard is now built around three questions — *what is it worth, am I on
schedule, does anything need me* — and nothing else.

| | before | after |
|---|---|---|
| panels | 12 | **4** |
| charts | 4 | **1** |
| page height | 3.3 screens | **2.2 screens** |
| rendered numeric values | 448 | **31** |

**The five blocks**, top to bottom:

1. **Hero** — total value, then the change since this person was last here.
2. **Needs attention** — real data, each item a link to the page that fixes it:
   an overdue month, months that arrived late, untagged sectors, positions with
   no live quote, cash idle for 45+ days. An empty list is a real state and
   says so ("Nothing needs you today").
3. **The deposit schedule in one line** — what arrived, when the next month is
   due, how many months were late. The late flag stays quiet, per the owner.
4. **One chart** — the value line with the contributed reference, via
   `PortfolioPerformance charts="value"`; the drawdown and index comparison are
   the performance page's subject, not this page's.
5. **Largest positions** — the top five with sparklines, each row a link into
   that region's table with the ticker preselected.

**The "since you last looked" baseline is a STORED daily value, not a live one**,
because a live value from a previous visit was never recorded and cannot be
invented. So the comparison is deliberately day-precise — "since your last visit
on 20 Sep" — and without an account (the gate carries no identity) it falls back
to the previous recorded day and says so. **New money is named separately**: when
deposits landed since the baseline, the caption says how much of the change is
simply contributions, so a deposit month cannot read as a good month.

**A real contradiction fixed on the way:** the value chart's header advertised
"+506.8% since 02 Mar" — the change in VALUE, which is almost entirely deposits —
sitting two hundred pixels under a hero saying "+21.5% since inception". Same
number, two meanings. The header now names the deposits inside the window and
what is left is the market's part.

**Everything that left this page still exists**, on the page that owns it: the
statistics, risk panel, correlation matrix and calendar-year table to
`/performance`, attribution to `/performance/attribution`, the stakeholder split
and deposit schedule to `/money`, the full ledger to `/positions/trades`. Nothing
was deleted, and all of it is in the command palette.

**Acceptance:** `npm test` 15 files / 229 tests, `tsc` clean, `eslint` clean,
`npm run build` succeeded, every old URL redirects (checked with real requests),
and the four dashboard blocks were read back from the running page rather than
assumed.

**Still open:** Part 18, the `/activity` merged ledger (specified, not built).
Until it exists, the newest entries live on `/positions/trades`, which is where
the old "Recent activity" panel pointed anyway.

---

## Part 19 — the accounts UI (DONE)

**Why.** Part 16 built accounts, but the only way to make one was
`npm run user:add` — a shell, on the machine that holds the database. That is a
fine bootstrap and a poor everyday tool: adding a stakeholder to a dashboard
they will open in a browser should not need a terminal, and the CLI cannot even
show you who already exists.

**Where it lives:** `/accounts`, reached from the bar's right-hand cluster
(the pill reads the account's own name once one exists, and "Accounts" while
there is none) and from the command palette under "Go to". It is chrome, not a
sixth object: nothing about the portfolio lives there.

**Three states, and the page says which one it is** rather than showing controls
that would 403:

| state | who | what they see |
|---|---|---|
| bootstrap | no account signed in, **0 accounts exist** | the banner, and the create form already open |
| manage | signed in as an account | the list, with per-row reset/remove |
| refused | signed in with the shared password while accounts exist | why, and the way in (`/login`) |

**The bootstrap rule is the one design decision worth reading twice.** With no
accounts at all, anyone already past the shared gate may create the first one.
Without it the page would be unreachable until somebody found a shell — the
exact errand this page exists to remove. The allowance then closes for good, and
`guardDeleteAccount` is what keeps it closed: **the last account cannot be
deleted**, so the count can never fall back to 0 and quietly reopen a page that
lets anyone holding the shared password mint themselves an identity. Once the
owner creates their own account, the shared password can still sign in (nothing
is gated behind accounts) but can no longer manage them.

**Rules are pure and tested, not restated in the UI.** `lib/accounts.ts` holds
the four decisions — `guardManageAccounts`, `guardDeleteAccount`,
`guardSetPassword`, `parseNewAccount` — as functions that take resolved facts and
return either `{ok:true}` or a status + sentence. The routes resolve the facts
(who is signed in, the account count, whether the current password verified) and
hand them over, so the rules can be tested without a database, a cookie or a
request object. 13 tests, including the one that pins the claim the UI makes in
two places: `parseNewAccount` agrees with `validatePassword` for every candidate
password, so the form and `npm run user:add` cannot start accepting different
things. The create-user script now calls `validatePassword` too, for the same
reason.

**Password changes:**

- **Your own** account needs the current password (a walk-up on an unlocked
  browser must not be able to take the account over). Wrong current -> **401**,
  missing -> **400**.
- **Someone else's** does not, because there is no email on file: an account
  holder resetting a forgotten password IS the recovery path, and the only
  alternative is a shell on the server. This grants no extra reach — every
  account sees the same portfolio — and the row says so in as many words.

**The API:** `GET /api/users` (list), `POST /api/users` (create, 400 invalid,
409 taken — including under a race, via the `P2002` catch),
`PATCH /api/users/[id]` (password), `DELETE /api/users/[id]`. All four resolve
the actor through `accountAdminContext()` (`lib/account-admin.ts`), which is also
what the root layout and the page call, so "may they" is decided once. It never
throws: a database hiccup resolves to a refusal rather than a 500, because the
layout calls it on **every** page — and the refusal is returned directly rather
than falling through to the guard, where an unreachable count of 0 would look
like the bootstrap and *allow*. `ACCOUNT_LIST_SELECT` is the single definition
of the columns an account is listed by, so `passwordHash` cannot start leaking
because one of the three queries was written as a bare `findMany()`.

**One query saved on the hot path:** the account count is only asked for when
nobody is signed in, because that is the only case it decides. An account holder
short-circuits to `ok` without the count, so the layout's extra work per page is
the session lookup it already needed for the nav — one query, not two, on a page
the owner waits for.

**Verified against the running app, not by reading it** (the whole surface, with
temporary accounts named `zz-check*` that were deleted afterwards — the `User`
table is back to 0 rows, checked):

- Gate session, 0 accounts: `GET /api/users` -> **200 `{"users":[]}`**; a bad
  username -> **400** with the same sentence the form shows; a 4-character
  password -> **400 "Use at least 8 characters."**.
- Create the first account with the gate cookie -> **201**; the SAME cookie is
  then refused with **403**, i.e. the bootstrap closes as soon as it is used.
- Signed in as that account, in the browser: `/accounts` listed it with a **YOU**
  badge, "Added 22 Sep 26 · last signed in 22 Sep 26"; **Add account** created a
  second one through the form (and a mismatched confirmation was caught client
  side with `The passwords don't match.`); the new row read **"never signed in"**.
- **Reset password** on the other row -> the new password signs in (**200**) and
  the old one is **401**, proving the reset landed rather than merely returning ok.
- **Remove** on your own row -> **400** inline ("That's the account you're signed
  in as"); Remove on the other row -> the confirm, then the row disappeared and
  the headline went back to **1 identity**.
- A duplicate name -> **409**, reported under the normalised name (`ZZ-CHECK-2`
  -> `zz-check-2`).
- The shared-password session's `/accounts` renders the **refused** state, and
  its nav carries **no** accounts link (checked: 0 occurrences of
  `href="/accounts"` on `/` — a link that always 403s would be worse than none).
- After deleting its account, the browser's cookie resolved to **no account** —
  `readAccount` looks up the live row, as lib/session.ts documents — and the bar
  fell back to the bootstrap state instead of erroring.

**Honest gap:** the `count <= 1` branch of `guardDeleteAccount` is unreachable
over HTTP today — an actor always counts itself, so the self-check fires first —
and is kept as a second line of defence with its own unit test. The native
`confirm()` before a delete is forced through in verification by stubbing
`window.confirm`; it auto-dismisses otherwise, which is the browser's, not the
app's, behaviour.

**Not built, deliberately:** per-account roles or permissions (accounts are
identities, not access levels — the owner chose this in Part 16 and nothing here
changes it), email/password reset links, and any account-to-`Contributor` link.

---

## Part 20 — Today in one screen (DONE)

**The owner's rule, stated as a rule this time:** the home screen must be
readable in one look on a desktop, and that must stay true as it grows —
"as much as possible, this should always be the philosophy of the home screen, a
one snapshot view".

**Measured before changing anything** (1440×821, real DOM):

| block | height |
|---|---|
| header | 38 |
| hero (value + needs attention) | 227 |
| deposits line | 42 |
| chart (incl. range control) | 376 |
| largest positions | 373 |
| **document** | **1272 — 451px of scrolling** |

**What changed.** Those last two blocks now share a row (`lg:grid-cols-5`, the
chart 3 wide and the positions 2), which removes 373px of stacking and leaves the
row as tall as its taller half. The page root gets a definite height on `lg`
(`calc(100dvh - 121px)` — 57px bar + main's 32px padding twice, measured), and the
chart is the column that flexes: `fill` hands it the leftover height instead of
its fixed 256px plot, with a 180px floor below which a line chart stops being
readable. A taller window therefore spends the space on the chart, a shorter one
shrinks it, and the non-shrinkable blocks (hero, deposit line, position rows)
were trimmed to make sure the row always has room: hero padding and gaps, the
position rows' vertical padding, and the page's own gaps.

**`fill` is a contract, not a preference.** It is threaded through
`PortfolioPerformance` and `PortfolioValueChart`, and both document why it must
not be used where an ancestor has no definite height: `height="100%"` inside an
auto-height parent resolves to nothing. It is passed by the dashboard only, so
`/performance` keeps three fixed, comparable charts.

**Late months are no longer on this page at all.** The owner asked for the
"7 of 18 months late" count to go, and the same fact was also a "Needs
attention" item — which made it the second thing a reader saw, on a page whose
whole job is to say what needs a decision. Both are gone: `/money` still marks
each late month with its clock badge and shows the schedule in full, and the
deposit line here states only what arrived and what is due next. (Rationale, from
the owner's own model: money in the account earns nothing, so a late deposit is a
note, not an alarm.)

**Verified in the running app**, at four viewports, by measuring the DOM rather
than looking at it:

| viewport | vertical scroll | chart plot | layout |
|---|---|---|---|
| 1440×900 | **0px** | grows to fill | chart \| positions side by side |
| 1440×780 | **0px** | 192px | side by side |
| 1024×800 | **0px** | 180px (floor) | side by side, no horizontal overflow |
| 420×860 | page scrolls (expected) | — | stacked, full width, no overflow |

**The sparkline bug this page had been hiding.** Every row in "Largest
positions" showed a dash instead of a trend, and it turned out not to be a
loading state: `TopPositions` sends keys built with `priceKey()` —
`"REGION::TICKER"` — while `app/api/sparklines/route.ts` split them on a SINGLE
colon. `"US::VOO"` therefore parsed as region `"US"` and ticker `""`, the whole
list was discarded, and the endpoint answered `{series:{}}` in 6ms with nothing
logged. The positions table worked only because it happened to build its keys
with one colon — which is exactly the kind of accidental agreement that hides a
bug for months.

Fixed at the root: `parseSparklineKeys()` in `lib/sparklines.ts` accepts both
separators (the response is keyed by `priceKey`, so handing a key back is the
obvious thing for a caller to do), drops anything without both halves, and keeps
the cap. `PositionsTable` now uses `priceKey()` too, so the app has one format
instead of two. Six tests cover it, including the literal regression
(`"US::VOO"`) and a mixed list. Confirmed live: five polylines render in the
dashboard rows, and the endpoint returns 22/21/21/21/21 closes for the five
holdings.

**A note on this session's environment, for whoever debugs here next:** while
this part was being built the same dev server served `/` in **28–53 seconds**
under load (the log records it), because `lib/prisma.ts` pins
`connection_limit=1` and every queued page waits on that single pooled
connection. It recovers to 2.7–6.3s once the concurrent requests stop. Nothing
here changed that; it is recorded because "the site is slow" is a recurring
complaint and this is the mechanism.

## Part 21 — the exposure page, and tagging as a system (DONE)

**What the owner asked for**, in four parts: the ring's centre text is too large
and sits on the graph; the tooltip (whose design they like) is painted *under*
that centre figure and is illegible; the tag input is far too large; and the
tags should be a system with a dropdown for tagging instruments in the same
sector. Plus two standing requests: no information added just to fill space, and
a discussion of which tags these instruments should get.

**Measured before changing anything** (real DOM, 1440px):

| symptom | measurement | cause |
|---|---|---|
| figure on the ring | hole ~99px, `S$62,258.57` renders 92px wide at 14px = **93% fill** | donut 160px with `innerRadius="62%"` |
| tooltip illegible | tooltip is a positioned sibling with `z-index: auto`, the centre label is painted **after** it | stacking order, not the tooltip's design |
| input too large | **933px** wide in a ~1130px row | `flex-1` with nothing bounding it |

**All six tooltips already share one recipe** (`panel border-ink-600 bg-ink-850
p-3 text-xs shadow-xl`), so "implement it throughout the site" needed no port —
only the one stacking fix, in `app/globals.css` (`.recharts-tooltip-wrapper {
z-index: 20 }`), which every chart inherits, plus the donut's header tone now
matching the other five (`text-ink-300`, was `text-ink-100`). Verified by
dispatching a hover at the USD sector: the panel paints above the ring and the
centre figure **fades out** while it is showing, because at this size a tooltip
covers the hole anyway and a number half-hidden behind a panel is worse than no
number.

**The donut, corrected:** 176px, `innerRadius="66%"`, centre figure 12px — the
number now occupies about two thirds of the hole instead of 93% of it. Slices are
capped at the palette: **five named + "Other tags"** fills the six `data.*`
colours exactly, and the folded buckets are listed behind a disclosure under the
legend rather than dropped. The unclassified slice keeps its own desaturated grey
(`#8f8b85`), so it never reads as just another exposure category.

**One panel, two cuts of the same holdings.** "By sector" (hand-tagged) and "By
type" (reported by the lookup) are the same circle sliced two ways, so they share
a panel and a toggle rather than two donuts side by side. The type view needs no
owner input, which is why it is complete from the first render: **51% of the
holdings sit inside a fund** — the one thing a sector tag on a fund cannot say.
The switch replays `.swap-in` on a keyed container, the same motion the period
selectors use.

**The tag vocabulary — ten tags, and what they deliberately refuse to claim.**
`lib/sectors.ts` holds both halves of the system so they cannot drift: the
vocabulary the dropdown offers, and the classifier that drafts a tag.
`SECTOR_TAGS` is *not* GICS. 61.6% of this portfolio is index and sector **funds**,
and a fund has no sector — VOO is not "Technology" even though technology is a
third of it — so a tag answers the question the owner can act on ("what did I
choose to buy, and how much is on that one idea") rather than claiming a
look-through breakdown no free source provides. Two pairs worth knowing:
**D05 + XLF** are one exposure (financials, 33% of the portfolio, which is where
a shared label does real work), and **B + SLV** are one trade (precious metals)
with two instruments. Two entries are recorded as judgement calls: **IREN**
(revenue is now AI data centres, filed under US Tech; a Crypto tag would be a
singleton covering 3%) and **VUG** (large-cap growth is mostly technology, but
tagging a broad growth index "US Tech" would overstate a bet nobody made, so it
is left unclassified rather than guessed into the wrong bucket).

`suggestSector()` covers **all 18 held instruments by name and ticker**, pinned by
`tests/sectors.test.ts` — which also pins the two rules that were learned from a
failing test rather than chosen: `\b` goes at the START of a pattern ("Financial"
with a trailing boundary does not match "Financials"), and the words kept whole
are the ones where inflecting changes the meaning ("gold" matched Goldman Sachs,
so it takes a lookahead).

**Tagging as a system, in the table.** A `TagSelect` combobox: dropdown over the
vocabulary, free text still allowed (the vocabulary is not a cage, and legacy
tags keep rendering *and* stay pickable), `↑/↓` only move within the popup so the
caret never jumps mid-word, Enter commits, Escape reverts rather than clears.
Rows carry checkboxes, so a sector can be applied to several instruments at once —
which is the point of grouping. Where the classifier has a draft it is **offered,
never applied**: "suggested: Financials →" on its own line, plus one batch button
("Accept the 18 suggestions").

**The bug that would have made the two paths disagree:** accepting a suggestion
one row at a time wrote `sectorSource: "manual"` while the batch path wrote
`"auto"`, so the same tag on the same instrument would have been marked
differently depending on which button was pressed. Both paths are `"auto"` now —
the tag is the classifier's, and the chip means "nobody typed this".

**What the owner asked me to judge rather than pad.** Added: **weight %** (rows
are value-sorted, but D05 is 30.6% and OV8 is 1.0% — tagging effort should follow
that number) and **instrument type** (Fund/Stock; not decoration but the honest
disclaimer, since a sector label on a fund is a simplification). Rejected, with
reasons: **region and currency** (one click away on the region tabs), **cost
basis / unrealised P&L** (that is the positions tables' job — duplicating it makes
this a second positions page), and **"last tagged by"** (accounts are identities,
not roles, so there is nobody to attribute it to).

Two smaller fixes came out of the same pass. The header's coverage caption
("0% of value is sector-tagged") duplicated what the sector panel already says
under its own caption, so it is stated once. And `.field` gained
`placeholder:text-ink-500`: the browser default placeholder colour (#9ca3af) is
*lighter* than this theme's muted text, so a placeholder read as a filled-in
value — which is exactly why "suggested: Financials" looked like something
already typed into the box. The placeholder is now "untagged" and the suggestion
is stated once, where it is clickable.

**Schema.** `TickerMeta.sectorSource` (`"auto" | "manual" | null`), migration
`20260922170000_add_ticker_sector_source`, additive and nullable so the deployed
revision ignores it. A new instrument gets a draft automatically at creation
(`ensureTickerMeta`), and a **cleared** tag is never re-filled by a later refresh —
that would be a guess overriding an explicit "no".

**Verified against the running app**, not by reading it:

- Donut: `svg 176x176`, sector path `M 171,88 A 83,83…` drawn, centre figure ~65%
  of the hole, hover puts the tooltip above the ring and fades the figure.
- Toggle: clicking "By type" switches to `aria-pressed=true` with
  `Funds (ETF) 51.0% / Single stocks 49.0%`, caption and `.swap-in` both updated.
- Dropdown: opens with all ten tags in order.
- Write path, end to end: clicking a suggestion wrote D05 → Financials, the row
  read `Saved` with the `auto` chip, and the bar went to "17 of 18 untagged".
  Then "Untag selected" put it back to empty **and the DB is as it was found**:
  18 of 18 untagged, no rows written.
- Responsive: at 420×860 the row wraps, the tag control takes its own line, and
  horizontal overflow is **0px**.
- `npm test` 17 files / **270 tests**, `tsc --noEmit`, `eslint` and `next build`
  all clean.

**One environment trap worth recording:** Next 16's dev server *blocks cross-origin
dev resources*, so loading the app on `127.0.0.1:port` while it was started on
`localhost` silently breaks hydration — the page renders, the charts never
measure, and nothing is logged beyond HMR websocket failures. Use the host the
server printed, not an equivalent one.

---

## Part 22 — Today's movers, and the colour rule (DONE)

The owner's list, and what each item turned out to be:

1. **"Needs attention" was the wrong tile.** On a portfolio built by monthly
deposits there is usually nothing to decide, so the panel spent its life saying
"Nothing needs you today". It is now **Today's movers** — top three gainers and
top three losers by the latest session's percentage move, each a link into that
position.

**Where the data comes from, and why it is free:** `QuoteMeta` gained
`dayChangePct`, read from the same `v8/finance/chart` response that already
prices every position. It is parsed from `regularMarketChangePercent`, which
Yahoo reports in **percent units** — divided by 100 once, at the parse, so every
rate in the app stays a fraction. Deliberately NOT derived from
`chartPreviousClose`: that field is the close *before the requested window*, so
at the default range "today's move" would have been a month's move. Three tests
pin the conversion and the null cases.

Ranked by percent, not dollars: ranking by value would just print the largest
holdings back every day. Positions with no reported change are excluded rather
than shown flat — a missing quote is not a flat day.

2. **The attention list, trimmed to what is actually urgent.** Kept: a closed
month with no deposit recorded, and positions with no live quote (a number on
screen is wrong). Dropped from the dashboard: untagged sectors (that is the
whole point of `/positions/exposure`) and idle cash (the owner parks money in the
account on purpose — nothing here earns interest). Both had `tone: "info"`, so
the panel no longer renders a category of nudge it would rather not make.

3. **The colour rule, enforced in five places.** Colour means up or down; a value
that is simply a value is neutral. Fixed: the Today hero total, the
largest-positions values, `/money`'s total outlay, the stakeholder table's
Contributed and Current-value columns (and its totals row), and the
`/performance` "Holdings value" stat. Left coloured, because they are gains:
P&L, returns, XIRR, the attribution cells, and the attribution's biggest-
contributors amounts — confirmed with the owner rather than assumed, since that
panel is a ranking but the figures in it are position gains.

**Verified in the running app:** the tile rendered
`GAINERS ONON +9.48% · S63 +2.89% · DRAM +2.37%` / `LOSERS XLF −1.85% · 01810
−1.38% · NOW −1.25%`, and the hero total and every position value on the
page now render in `ink-100` with only the percentages coloured.

---

## Part 23 — palette prominence, and tables that fit (DONE)

**The palette.** Wider (`max-w-2xl`), a taller input at `text-base`, a 2px gold
top edge, a heavier shadow, and a blurred backdrop, so it reads as the primary
control it is. Results are now **grouped** under `ACTIONS` / `GO TO` / `LENS` /
`HOLDINGS` headings instead of repeating the group on every row, and the active
row is marked by a gold left rail as well as a background — a 2px rail plus a
10% tint is findable at a glance, where a shift from `ink-850` to `ink-800` was
not.

Grouped rendering had one trap, handled: the keyboard walks the FLAT filtered
list, so each grouped row keeps its flat index (`data-index`) and the
scroll-into-view looks the row up by that attribute rather than by child
position — otherwise the arrows would have reset to the top of the group.
Verified: typing `pos` then ArrowDown selected index 1 (`Positions · HK`),
`aria-activedescendant` followed, and the groups announced as `Go to`, `Lens`,
`Actions`.

**The tables.** Measured before touching anything, at a 1440 viewport where the
scroll container is 1218px:

| table | was | now |
|---|---|---|
| `/positions/trades` (11 cols) | 1531px → 313px of scroll | **1218px, fits** |
| `/positions/us` (11 cols) | 1406px → 188px | **1218px, fits** |
| `/performance/realized` (10 cols) | 1432px → 214px | **1218px, fits** |
| `/performance/attribution` (21 cols) | 1815px | 1626px — still scrolls, by nature |

The date column was 67px wide, so `16 Sep 26` broke across three lines and the
row stood 81px tall. Now `.ledger-table td` is `whitespace-nowrap` and the date
cell is one line. The three fixes that bought the width back: the instrument-name
subtitle is capped at 13rem (it alone was setting a 330px column), note cells cap
at 11rem, and ledger padding went `px-3` → `px-2`. Two headers were abbreviated
where the long form was the widest thing in the column (`Unrealized P/L (%)` →
`P/L (%)`, `Running avg cost` → `Running avg`), with the full wording moved into
`SortableTh`'s new `title`.

The attribution matrix is the honest exception: 19 months is 21 columns and
cannot fit at a readable size, so it keeps its horizontal scroll and its pinned
first column — but it now uses `table-compact`, which is defined as "this
table's column count is unbounded" rather than as a style choice, and that fits a
few more months on screen.

**Two bugs found by measuring rather than reading:** `SortableTh` gained `title`
as a type but not as a destructured prop, so every sortable table threw
`ReferenceError: title is not defined` (caught only because the dev server's
stderr log was read — the browser console shows an empty line for an Error
object), and `Select the 0 untagged` was a button whose entire effect was to
select nothing, now hidden when there is nothing untagged.

---

## Part 24 — set-once tags, and the text pass (DONE)

**The tag control is a chip now.** Requested: *"the tag box should present itself
as a one time set and forget instead of a dark box which implies often changes"*.
So a tagged row rests as a label — a bordered chip showing the tag, with a pencil
that appears on hover — and clicking it opens the editor inline. An untagged row
shows a dotted-underline `+ Add a tag` and, while it has no tag, the classifier's
draft as `+ Financials`. Three states, and none of them is a permanently empty
input box.

Saving follows the same idea: Enter or picking an option commits, Escape reverts,
and **clicking away settles** — a changed draft is saved, an unchanged one just
closes. A row can never be left showing a value it has not stored. `TagSelect`
gained `autoFocus` and `onBlur` for this, and its `▾` toggle now
`preventMouseDown`s so opening the list cannot blur the field and settle the row
before the list is usable.

**The "auto" chip is gone**, as asked. Provenance is still written
(`sectorSource`) because it is worth keeping, but nothing renders it — a badge
narrating which button produced a tag made a settled label look unresolved.

**The text pass.** Removed, by request: `/money`'s
`7 of 18 scheduled months arrived after the month closed — worst MAR (2026),
44 days late`, the Today deposit line's `arrived on time` / `N days after the
month closed` commentary, and the `N days after the month closed` clause in the
clock badge's hover note (which now says exactly what it was asked to say: *Late
deposit — MAR (2026) allocation deposited on 14 May 26*). The quiet clock badge
itself stays, one per late month, as a passive mark.

Shortened elsewhere, keeping the meaning: the exposure page's currency caption,
its "holdings only" line and both unclassified notes, the attribution's
summary/footer/cross-check prose, the stakeholder table's pro-rata note, the
positions table's mixed-currency and no-quote caveats, and the four risk captions
(HHI bands, the rolling-year explanation, the correlation legend, and the
time-weighted note).

**Flagged, not deleted** — these are notices that change how a figure above them
should be read, and each was kept (shortened) rather than removed: the value
chart's "value change, not return" split, the attribution cross-check, the
no-live-quote caveat that says the totals understate, the `at cost` markers, and
`Unclassified is not an "Other" sector`.

**Verified in the running app, with the real data:** all 18 rows render chips,
there are **0** `auto` labels and **0** text inputs resting in the table; clicking
the D05 chip opened a focused editor with its dropdown, and Enter committed the
same value and returned the chip (no row was left dirty, no data changed).
`/money` no longer contains the late-deposit sentence (`grep` of the rendered
body: 0 matches) and still renders its seven clock badges.

**Owner follow-up (2026-09-23): "remove the checkboxes from positions >
exposure, they dont fit the site".** The selection column is gone, along with the
machinery it fed: `selected`/`batchTag` state, `toggle`, `applyToSelected`,
Select all / Select the N untagged / Clear selection, the batch tag picker,
Apply-to-N and Untag selected. `TagSelect` keeps no `dense` variant, since the
only caller of it was that toolbar. What remains of the bar is one line —
`0 of 18 untagged` — plus the one batch action that was never about selection
(Accept the N suggestions). Grouping is now done by TAG rather than by
tick-boxes, which is the same outcome: two instruments in one trade get the same
tag, one row after the other.

The column template was re-balanced in the same pass, because removing the
leading 1.5rem column left the instrument column at `1fr` in a 1230px panel —
~690px wide, so a row read `name ……… S$19,061.00` across a hand-span of empty
space. The name is now capped at 20rem and the tag column takes the slack, which
puts the figures beside their instrument and moves the leftover room to the one
cell whose contents vary in width. Header and body measured identical
(`x = 53, 385, 485, 545, 621, 1166` for both), 6 cells per row, no document or
row overflow, and no chip is clipped.

---

## Part 25 — The ledger derives its own line; notes stop repeating the name (DONE)

The owner's request: *"how can i re-imagine or semi-automate the notes? currently
my notes are a mess, including the stock name and some unhelpful information like
'second buy'."* Part 8 held the options; this is the approved one, built.

**`lib/notes.ts` (new, pure):**

- `ledgerSummary(row, symbol)` turns a ledger row into what it did to the
  position — `Opened · 5 @ US$546.00`, `Added 5 @ US$520.00 · avg US$546.00 →
  US$537.33`, `Closed · sold 20 @ US$207.12 · -US$857.60` — from `qtyBefore` /
  `avgCostBefore` (added to `LedgerRow` in `lib/portfolio-engine.ts`, both taken
  from the position state carried INTO the row) plus the `runningQty` /
  `runningAvgCost` / `transactionValue` the engine already produced. Derived on
  every render, never stored (invariant 1).
- `classifyNote(raw, { ticker, name })` → `empty` | `reference` | `context`. A
  note is `reference` only when `isNameOnly` proves every meaningful word of it
  appears in the cached name, after dropping a `TICKER - ` / `TICKER: ` prefix
  verbatim. `nameTokens` drops boilerplate (`etf`, `fund`, `trust`, `index`,
  `holdings`, `ltd`…) and light-pluralises, so `… ETF Shares` and `… ETF`
  compare equal. One-character leftovers are tolerated (`XIAOMI-W` against
  `Xiaomi Corporation` is a name), a text made only of such leftovers is not.

**Where it shows:** `EditableTransactionRow` renders the owner's note when there
is one and the derived line when there is not (muted `text-ink-500`, because it
is generated rather than written), with the other one in the cell's `title`; the
header moved to `Note` with a tooltip explaining the two sources.
`TransactionHistoryModal` does the same per trade cycle, matching the same
`companyName` the route already returns. The edit row still shows the stored text
in its input, and says which case it is in plain words — either "Just the
instrument's name — the ledger shows that from the ticker lookup, so this can be
cleared." or the derived line it will render instead.

**The derived line, measured rather than guessed.** It is rendered 12px in a
`max-w-[11rem]` cell — about **165px, roughly 24 characters** — and the first
version ran 26–38 characters, so **26 of 64 rows truncated**. Worse, the amount
was at the end of the line, which is exactly what truncation eats. Hence the
three rules now on `ledgerSummaryParts`: one currency figure per line, a fraction
instead of a remainder, and the figure placed as early as the grammar allows.
The line is also a component (`components/LedgerLine.tsx`) rather than a string,
so the realized amount keeps the colour rule — a gain or a loss is coloured, an
average cost is not — while the caption as a whole stays muted and smaller than
the row, marking it as generated rather than written. After the change **no
derived line truncates**, and the four that still do are the owner's own long
notes, each with its full text one hover away.

**`scripts/notes-cleanup.ts` (`npm run notes:cleanup`, dry run by default):**
prints every row that would move, with its reason, then applies it only with
`--apply`, writing `notes-backup-<stamp>.json` first. Buckets on the live ledger,
as reviewed:

```
rows              64
reference         25   the instrument's name
reviewed-name      4   the four the owner cleared by hand
restates-action   19   an ordinal, an action, or a fraction already derived
achieved-average   3   `Avg down to x10@$263.25`
odd-lot            3   kept, with the ordinal removed
keep               5   the SL/TP notes, the FLKR alias, `1st TP`
```

The digit check runs on the text OUTSIDE any parentheses, which is what keeps
`100% Stoploss Exit (62.4 SL, 78 TP)` and `1st TP` — an amount outside
parentheses is a plan, and a plan is never cleared. A second run prints
`0 / 0 / 64`, so the operation is visibly idempotent.

**One refactor the module forced:** `formatQty` / `formatAmount` moved to
`lib/format.ts` (re-exported by `components/SignedNumber.tsx`, so no call site
changed). `lib/notes.ts` needs them, and a `lib/*` module importing from
`components/*` points the dependency arrow the wrong way; the alternative was a
second copy of `toLocaleString`.

**The width trade, measured:** widening the Note column to fit the derived line
(`max-w-[14rem]`) pushed the trades ledger to 1262px — 82px of horizontal scroll
at a 1280 window. The cap stayed at the Part 23 value of **11rem**, so the table
is back to **1214px** (unchanged from before this part) and the derived line
truncates with the full text on hover.

**Verified in the running app (real data, 1470×900):** 64 rows, **25 render the
derived line and 39 render a note** — the same split the tests and the dry run
assert; the DXJ/ONON/IREN rows that used to show `WisdomTree Japan Hedged Equity
ETF` now show `Opened · 6 @ US$177.00`; the NOW row keeps `NOW - 1st TP` with
`Sold 10 @ US$144.00 · +US$420.00 · 5 left` in its title; the history modal shows
`Opened · 15 @ US$102.00` where it used to show `NOW: ServiceNow`; the edit row
restores the stored note untouched and labels it as just the name; document
overflow 0, no console errors.

**Verification:** `npm test` **18 files / 292 tests** (20 new in
`tests/notes.test.ts`, pinned against all 64 real notes), `npx tsc --noEmit`
clean, `npx eslint app components lib tests scripts` clean.

**Applied, not just planned (2026-09-23):** `npm run notes:cleanup -- --apply`
wrote **59 rows** (51 cleared, 8 rewritten) from backup
`notes-backup-2026-09-22T18-13-27-560Z.json`; the 5 kept notes are byte-identical
to what they were. Verified against the database afterwards: **13 rows carry a
note, 51 do not**, and the ledger renders the same split.

**Still open here:** modelling the SL/TP levels as structured data. (The
watchlist, the other thing this left open, was finished in Part 26.)

---

## Part 26 — the watchlist stops being a price list (DONE)

The owner's request, in three words: *"upgrade the watchlist section"*. The
rewritten version it was approved as, and the evidence behind it:

**What was actually wrong.** The watchlist held **2 rows** and neither ticker had
a `TickerMeta` row at all, because the page called `fetchQuotesForPositions` —
the prices-only wrapper — while every other surface used `fetchPositionQuotes`,
whose single upstream call already returns the name and the day change. Two
consequences were visible without looking for them: the page showed a bare price
with **no day change** (the number a watchlist exists for, thrown away in the
payload it had already downloaded), and `app/api/palette/route.ts` reads names
from that same cache, so **XLV and CRWD appeared nameless in the command
palette**. `Watchlist.notes` was also still hand-typing the instrument's name
(`State Street Healthcare ETF`, `Crowdstrike`) — the habit Part 25 had just
deleted from 64 ledger rows, in a second model Part 25's classifier never
reached.

**`lib/watchlist.ts` (new, pure)** — `WatchlistRow` plus `watchlistRows()`. One
builder shared by the page and the refresh route, so a 60-second poll can never
disagree with the first render, and the row is `{ id, region, ticker, notes }`
from the database plus `name` / `price` / `dayChangePct` resolved from the quote
call. A cached name wins over the fetched one (it may be hand-edited), matching
the precedence the holdings path uses.

**`app/watchlist/page.tsx` + `app/api/watchlist/route.ts`** now make the full
`fetchPositionQuotes` call and `ensureTickerMeta(...)` the result, which is what
puts a watchlist ticker into the cache the palette reads. `GET /api/watchlist`
returns the same shaped rows. `fetchQuotesForPositions` was deleted with its last
caller.

**The panel**: ticker with the resolved name and an editable override
(`TickerName`) instead of a typed name in a note, `Price`, `Today` (day change —
the only figure on the row that carries colour, per the colour rule), a **30d**
sparkline, and `Why` as the one editable text field. The add form asks for a
*reason*, not a name.

**The trend, and a wrong turn worth recording.** The obvious source looked free:
the quote payload the page already downloads carries bars, so the first version
parsed them out of it. Measured against the live response, those bars are the
**current session's 1-minute bars** — `range: "1d"`, `dataGranularity: "1m"`,
**299** of them, every one stamped with today's date — so the column was labelled
`30d` over **thirty minutes** of data. Reading them is now explicitly not done
(`lib/prices.ts` says so where the parser would have gone), and the trend comes
from `app/api/sparklines?keys=…` instead: one batched, 15-minute-cached request
per page, keyed by `priceKey()`, exactly as `PositionsTable` and `TopPositions`
already do. Two attempts at "free" data were wrong; the third reused what works.

**Column widths, because a five-column table sized by content is mostly
whitespace.** Unpinned, the instrument column took **559px** and the reason
column **264px**. Every column but `Why` is now pinned (`w-[24rem]` /
`w-[7rem]` / `w-[6rem]` / `w-[6rem]` / `w-8`), so the slack lands on the one
column whose contents actually vary. Measured at 1470×900: header and rows
identical at `x = 33 / 417 / 529 / 625 / 721 / 1405`, document overflow 0. And
`TickerName` gained an optional `maxWidthClass` (default unchanged at
`max-w-[13rem]`): the ledger's cap exists because a content-sized table lets the
longest name set a 330px column, but this table has slack — so it passes
`max-w-[10rem] sm:max-w-[22rem]`, which shows
`State Street Health Care Select Sector SPDR ETF` in full on a desktop and
still fits a phone (measured at 430px: **0px** of sideways scroll, `30d` and
`Why` hidden).

**Verified in the running app, with the real 2 rows:** names resolve
(`CrowdStrike Holdings, Inc.`, `State Street Health Care Select Sector SPDR ETF`),
day change shows (+0.72% / +0.38%), both sparklines render 21 closing days, and
`GET /api/palette` now returns `{"name":"CrowdStrike Holdings, Inc."}` for CRWD
and the full name for XLV. The reason field was exercised end to end — typed
`Waiting for a pullback`, survived a reload, then cleared back to blank and
survived that too — so the watchlist was left exactly as it was found. The
hand-typed names were the only rows the owner had, and they are gone from the
stored `notes`.

**Verification:** `npm test` **20 files / 307 tests** (`tests/watchlist.test.ts`
is new; the price tests lost the series-parsing cases when that parser was
reverted), `npx tsc --noEmit` clean, `npx eslint .` clean, `npx next build`
clean, no console errors, one sparklines request per page load.

---

## Part 27 — the watchlist answers "when should I buy", and the trade-history
modal comes onto the current design (DONE)

Two requests, and the owner picked the scope of both before any code was
written: **Standard** signals (not Light, not Full) and a **redesign plus a
structural fix** of the trade-history modal (not a visual-only pass, and not
new data).

### The signals, and why they are one click down

`lib/entry-signals.ts` (new) turns a year of daily closes into four facts:

- **`sma(values, n)`** — the simple average of the **last** n, or null when
there are fewer. A 200-day average from 30 sessions is not a 200-day average,
and a shorter one would quietly mislabel the trend.
- **`rsiWilder(closes, period)`** — Wilder's smoothing, seeded from the first
  `period` changes and then `(prev * (period - 1) + new) / period`. Pinned by a
  hand-computed case: `[10, 11, 10, 11, 10]` over period 3 gives **44.444**,
  where a plain mean of gains and losses gives exactly 50 — so the test fails if
  anyone "simplifies" it. Reads 100 with no down change, 0 with no up change,
  and 50 on a flat series rather than dividing by zero.
- **`rsiZone`** — the conventional 30/70 bands in words. Deliberately only two
  bands: a third ("strong", "extended") would be a judgement dressed as a
  measurement.
- **`entrySignals(closes)`** — range low/high, position in that range, % below
the high, RSI, both averages, price against each, and a `trend` of
  `up` / `down` / `mixed`. **Mixed is a real answer**, not a failure to decide:
  price below its 50-day while the 50-day is above the 200-day is neither an
  uptrend nor a downtrend.

Two rules shape the whole module: **no composite score** (a number with no units
nobody can check) and **absent beats invented** — under `MIN_SESSIONS` (200, the
longest single window any signal needs) the function returns the session count
and nulls everything else, one guard for the whole set instead of each field
answering for itself.

`app/api/watchlist/signals/route.ts` is the batched caller: one request for
every row, four fetches in flight at a time through `mapWithConcurrency`, an
hour of TTL cache (daily bars change once a day, and `fetchHistoricalCloses`
already sits behind Next's hour of fetch cache), and a 60-symbol cap. That is
the same shape as `app/api/sparklines/route.ts`, for the same reason — a request
per row is a waterfall — and **no new data source**: it is a second caller of
the history fetch the benchmarks already use.

**Where it shows, and why not as columns.** The row gained a chevron and a
narrow **1y range** column (a gold track with a marker — gold because the
position in a range is not a gain or a loss, and the colour rule says colour
means up or down). The four signals themselves live in an expanded strip under
the row, because this table has six columns already and the owner has twice
asked for no horizontal scrolling: the row stays the snapshot, the deliberation
lives a click below it. Measured at 1470×900: header and rows identical at
`x = 33 / 417 / 529 / 625 / 721 / 1405`, document overflow 0, no inner scrollers.

**One rounding fix worth recording:** at 0.9954 of the range a rounded
"100%" sat next to "0.3% below its high" and contradicted it. `RangeBar` now
exports `rangePositionLabel`, to one decimal, and both the row's tooltip and the
detail use it — so the bar's accessible name and the words beside it cannot
disagree.

### The modal: one scroll container, a summary, and one card per cycle

`components/TransactionHistoryModal.tsx` was rebuilt around three changes:

1. **The nested scroll is gone.** Each cycle's table was a `.table-scroll` —
   `max-h-[70vh] overflow-auto` — inside a modal body that also scrolled, which
   is where a wheel gesture goes to the wrong element. The cycle table is now
   `overflow-x-auto` only (horizontal is unavoidable for six columns on a
   phone) and **nothing inside the modal has a `max-h`**; the modal body is the
   one vertical scroller. Verified live: zero inner scroll containers, and the
   cycle tables' header and row cells are pixel-identical (`96 / 80 / 72 / 112 /
   104 / 373`), with the slack on the Note column.
2. **A summary strip above the cycles.** Current price, avg cost of the open
   cycle, unrealised and realised P/L. Every figure was already computed for one
   cycle or another — the strip is a reorganisation, not an input the app did
   not have. The combined realised percentage now needs a real weight, so
   `computeCycleStats` returns **`costBasisSold`** and the strip sums by it,
   rather than recovering the basis by dividing P/L by its own percentage (which
   silently loses a cycle with no gain).
3. **Each trade is a bordered card** with the headline P/L in its header — open
   ones show unrealised, closed ones realised — because that number is the
   reason the modal was opened and it used to sit below a six-row table.

Also: `role="dialog"`, `aria-modal`, an `aria-label` naming the instrument, and
focus moved to the dialog on open so Escape and the scroll keys work without a
click first. The backdrop now matches the command palette (`bg-black/70` +
`backdrop-blur-[2px]`) instead of being the one overlay that did not.

**A signed-amount fix:** the SGD line under a negative return was shown as a
magnitude (`S$161.19` beneath `-3.70%`), which reads as a gain. It carries its
sign now, while the colour stays on the percentage alone.

### Verification

- `npm test` **21 files / 324 tests** — 17 new in `tests/entry-signals.test.ts`:
  the hand-computed Wilder case, the degenerate RSI readings, the
  last-n semantics of `sma`, the `MIN_SESSIONS` boundary, `mixed` trend, NaN
  handling, and `parseSignalKeys` for both separators and the cap.
- `npx tsc --noEmit`, `npx eslint app components lib tests`, `npx next build`
  clean; the build registers `/api/watchlist/signals`.
- **In the running app, with the real data.** XLV reads *86.7% of the 1-year
  range · 3.1% below its high · RSI 55.2 (neutral) · Uptrend, +1.8% vs 50-day,
  +9.0% vs 200-day* from 252 daily closes; CRWD reads *99.5% of the range · 0.3%
  off its high · RSI 64.2 · Uptrend, +18.6% and +67.8%*. The endpoint answers in
  one request for both keys.
- **The trade-history modal** opened by clicking a position row: `role=dialog`,
  `aria-modal=true`, labelled **"Transaction history for Barrick Mining
  Corporation"**, focused, **zero inner scrollers**, cards reading *Trade 3 open
  · Held 9mo · Unrealised −3.70%*, *Trade 2 closed · Realised +37.31%*, *Trade 1
  closed · Held 2mo · Realised +15.13%*, summary *+25.62% realised / −S$161.19
  unrealised*.
- **The degenerate paths, exercised rather than assumed**, using a throwaway
  ticker added through the UI form and removed again (which also closes Part
  26's unverified add/remove gap): a ticker with no history renders *"Not enough
  history to read yet — 0 trading sessions, and these signals need 200"* and
  every cell shows `—` with an explanatory tooltip. The watchlist was back to its
  real **2 rows** afterwards.

---

## Part 28 — the entry-level chart, a range bar that stops looking draggable, and
the explanation the tiles were missing (DONE)

**The bar was read as a control.** A filled track with a round knob on it is
what a slider looks like, and the first version was reported as "looks like it
can be moved". The knob is now a 2px vertical **needle**, the track carries
**graduations at both ends**, and there is no hover state anywhere on it: a
control has handles, a gauge has a scale.

**`SignalsExplainer` (new)** — the four tiles stated facts and stopped, which
was a deliberate first choice and turned out to be one step too austere: "RSI
27" is only useful to someone who already knows what it implies for a purchase.
A collapsible panel now gives each measure what it is, how it is normally read,
and the caveat that makes it honest — range position is a level, not a
justification; under ~5% off the high there is no cushion so a stop has to sit
close; RSI can stay extreme for weeks so it is "stretched right now", never a
date; an uptrend with a dip in it (what `mixed` usually describes) is the
"buy the pullback" setup, while a downtrend is where cheap keeps getting
cheaper. It closes by saying plainly what the four cannot tell you — whether the
company is worth owning, and how large the position should be. Collapsible for
the same reason `BenchmarkExplainer` is: several paragraphs do not belong open on
a one-glance page, and a tooltip is unreachable on touch.

**`EntryLevelChart` (new)** — a year of daily closes, with the two levels an
entry decision actually refers to: the window's low and high drawn as dashed
ink lines, and the **50-day average** as a second series. Volume was offered and
declined (it answers "was there conviction", not "where would I buy"). Colours
follow the app's multi-series rule: price is the primary series and keeps the
brand gold, the average is a reference in the muted data steel, the levels are
chrome in the ink greys. The chart and the tiles cannot disagree, because
`getEntryAnalysis` returns the closes AND the measures from ONE fetch, and the
chart's average line is `rollingSma` — whose last element a test pins to
`sma()`, the number the Trend tile prints.

**A real bug, found by measuring the DOM instead of trusting the picture.** The
chart's SVG had grown to **2577px inside a 1360px panel** — absorbed as
horizontal scroll, so it looked like a chart that simply ended in March. The
cause is structural: a `ResponsiveContainer` measures its own container, and
inside an **auto-layout table cell** that is a feedback loop — the chart writes a
pixel width into the cell, the cell's min-content then includes that width, the
table widens, and the observer measures a wider box again. The table is
`table-fixed` now, so its columns come from the widths declared on the header row
and no cell's content can move them. Re-measured: SVG **1245px** in a 1261px
cell, panel scroll **0**.

**Verification:** XLV's chart draws 252 daily closes with the dashed high at
US$175.68 and low at US$134.13 matching the tiles exactly; the explainer opens
with four terms and four paragraphs (360–460 characters each); the panel scrolls
neither axis (`scrollWidth === clientWidth`), document overflow 0.

---

## Part 29 — Today's movers show the price (DONE)

The tile said `ONON +8.40%`, which is a percentage with nothing to attach it to:
you cannot place an order against a change. Each movers row now reads
`ONON · US$29.62 · +8.40%` — price in the holding's own currency (US$, S$, HK$),
neutral ink because a price is a value and colour here means up or down, with the
change in a fixed-width cell so the percentages form a column. The link's
tooltip still carries what is held (`S$1,888.55 held · ONON at US$29.62`), since
the position value is the one thing the row deliberately leaves out to stay
readable at a third of the window's width. Measured: 6 movers, panel 415px, no
overflow inside the panel or the document.

---

## Part 30 — Accounts get roles: a request queue, josh as admin, and "Add
account" on Today (DONE)

Until now an account was all-or-nothing. Any holder could create another, reset
any other account's password, or delete it — harmless while every account saw
the same dashboard, and exactly the wrong shape for the first thing the owner
asked for here: adding an account should not be something anyone can do, and
should be something an admin can *review*.

**Schema.** `User.role` (`"admin" | "member"`, default `member`) and
`User.approvedAt` (NULL = a request that cannot sign in yet). Migration
`20260923100000_add_user_roles_and_approval` backfills `approvedAt` from
`createdAt` for every existing row, which is not a formality: those accounts were
made on purpose, by hand or by the CLI, and leaving them NULL would have locked
out everyone who currently has one. It then makes **`josh` the admin**, guarded
so it is a no-op where that username does not exist.

**`lib/accounts.ts` — the rules, pure and pinned by tests.** `isAdmin` (the one
place the string is interpreted), `guardViewAccounts`, `guardManageAccounts`,
`accountCreationDecision`, `guardReviewRequest`, `guardDeleteAccount`,
`guardSetPassword`. Three of them encode a dead end worth naming:

- **The bootstrap creates an approved admin, not a member.** An approval queue
  whose only member cannot approve anything is a dead end, so the very first
  account is an admin. Once one exists the allowance closes for good — the last
  account cannot be deleted, so the count can never fall back to zero.
- **The last admin cannot be deleted** for the same reason, and the refusal says
  which rule it hit (`guardDeleteAccount` checks self, then the last account,
  then the last admin).
- **Resetting someone else's password is admin-only.** Not because a member
  gaining an identity gains any data — every account sees the same portfolio —
  but because resetting the admin's password, signing in as them and approving
yourself would walk straight around the queue.

The refusal is deliberately about the **object** rather than one verb: the same
rule answers a member trying to create, approve, reset or remove, and a message
naming only one of those reads as a non-sequitur for the other three. So it is
`Only an admin can manage accounts.` — while `guardReviewRequest` keeps its own
"Only an admin can approve account requests", which names the one action it
guards.

**Login refuses a pending account with its own sentence** — *"That account is
waiting to be approved by an admin."* — rather than the generic wrong-password
answer, because the person is not guessing: they are waiting, and the difference
is the whole feature. The rate limiter is untouched (a pending refusal is not a
failed attempt).

**`/accounts`** now leads with the queue when there is one: an accent-ringed
panel, `Approve` and `Refuse` per row (refusing deletes the request — there is no
email here, and the confirm says so). Below it, the list gains an **ADMIN** badge
and shows only the controls the rules would allow: `Change password` on your own
row, `Reset password` and `Remove` for an admin on someone else's. A member gets
`Request an account` instead of `Add account`, and no queue controls at all. The
server decides every one of these; hiding them is honesty, not enforcement.

**Today** gained what the owner asked for: an **Add account** button in the
header, and — when somebody is waiting — a line in the attention list reading
*"1 account request is waiting for approval."* Two things about how it is built:

- The admin check comes from `readVisit()`, which the page already resolves, not
  from a second `accountAdminContext()` call, and the request count is added to
  the **existing** `Promise.all` **only when the caller is an admin** — so the
  pooler pays one small count for the person who can act on it and nothing for
  everyone else. The bootstrap state is honestly not detected here (it needs the
  account count); that state is reachable from the nav's accounts chip, which
  the layout resolves, and it exists once in the app's life.
- `AttentionItem.tone` finally does something. It was declared and ignored, so
every notice drew the same red triangle — which would make a queue of people
look like a fault. `warn` renders the triangle, `info` an accent mark.

**Two layer-order traps hit again, both real:**

- `border-accent/40` on a `.panel` is **inert** — `.panel` is a component-layer
  rule carrying `border border-ink-700`, and the components layer beats
  utilities whatever the class order. The queue panel uses `ring-1
  ring-accent/30` instead, because `.panel` sets no box-shadow. (Measured:
  `borderColor` stayed `rgb(46,46,46)` — ink-700 — before the fix.)
- The create form's fields were sized on the **control** (`field w-40`), where
  `.field`'s `@apply w-full` discards it. Widths moved to the wrappers, the same
  fix Part 26 made to the watchlist form. Measured after: 160 / 176 / 176px.

### Verification — against the running app, with the real session

- DB read back: **one** row, `josh`, `role: admin`, `approvedAt` set. Migration
  reports *"Database schema is up to date"*.
- A seeded pending account, through the real login route:
  `403 {"error":"That account is waiting to be approved by an admin."}`.
- `/accounts` showed the queue with `Approve` / `Refuse` and the headline
  **"1 identity · 1 request waiting"**; Today showed the **Add account** button
  **and** *"1 account request is waiting for approval."* — with 0px of document
  overflow.
- **Approve clicked in the browser** (the real route, the real cookie): the
  headline became **"2 identities"**, the notice read *"Approved
  "zz-preview-check". They sign in with the password they chose."*, the queue
  disappeared and the row moved into the list.
- The **same credentials then logged in → 200 + session cookie**, which is the
  other half of the claim the queue makes.
- The **member view**, by signing in as that account for real: *Request an
  account* present; *Add account* absent; *Approve* / *Refuse* absent; *Change
  password* present; *Reset password* absent; *Remove* absent.
- A member's create → `201 "pending"`, and that account **could not sign in**
  (403). A member's DELETE, of an admin's account and of their own, → `403 Only
  an admin can manage accounts.`
- Every temporary row was deleted afterwards; the database is back to **one**
  account, and the throwaway scripts were removed from the tree.

**Checks:** `npx tsc --noEmit` clean, `npx eslint` clean, `npm test` **21 files
/ 345 tests** (`tests/accounts.test.ts` rewritten for the new signatures — 31
cases, including the bootstrap-admin rule, the last-admin rule and the
queue-bypass rule).

**Files:** `prisma/schema.prisma` + the migration, `lib/accounts.ts`,
`lib/account-admin.ts`, `lib/session.ts`, `app/api/users/route.ts`,
`app/api/users/[id]/route.ts`, `app/api/users/[id]/approve/route.ts`,
`app/api/login/route.ts`, `app/accounts/page.tsx`, `components/AccountManager.tsx`,
`components/Nav.tsx`, `app/layout.tsx`, `app/page.tsx`, `tests/accounts.test.ts`.

**Known gap:** the queue has no notification — an admin finds a request by
opening Today or the accounts page. That is deliberate for now (this is a
three-person portfolio, not a service), and it is the first thing to add if a
request ever sits unapproved for long enough to matter.

---

## Part 31 — the login page asks for an account, the modal pairs every figure
with its label, and the ledger is renamed (DONE)

Three requests, one of them with a question inside it — *think about how this
flow would be like for users, and give me honest feedback if it's bad* — so the
feedback comes first, because it decides what was built.

### The honest feedback: approval here is a name, not a door

The owner asked for this flow: a person can **request** an account from the
login page, and **while waiting** can sign in with the **shared password** with
no personalised account. That is coherent, but only under one reading, and the
reading is worth stating plainly because it is easy to build the other one by
accident:

- **The shared password already opens the entire dashboard.** So letting a
  pending person use it adds *no exposure at all*. Approval therefore does not
  control access; it decides **whose name the visits are recorded against** —
  which is what `lastSeenAt` and "since you last looked" need, and the only thing
  accounts have ever been for in this app (see Part 16's schema note).
- The bad version of this feature is the one where the owner *believes* the
  queue is a gate. It is not, and it cannot be while a shared password exists: a
  waiting person sees the identical portfolio, just anonymously. If access is
  what should be gated, the shared password is the thing to retire or rotate —
  not the queue.
- The flow's one genuine dead end is removed by the design below: a pending
  person has no way to learn they were approved (no email, and the shared-password
  session carries no identity), so the login page tells them where the request
  went, and signing in with their username is how they discover it landed.

### The login page: three ways in, named

One form whose behaviour changed with whether a username was typed is a rule the
**server** has, not something a person should have to infer from a footnote —
which is exactly how the old page handled the shared password ("leave the
username blank"). There are now three modes, each asking only the questions it
needs:

| mode | fields | who it is for |
|---|---|---|
| **Sign in** | username + password | an account that can sign in |
| **Request an account** | username + password + confirm | anyone who has not been let in yet |
| **Shared password** | password | the original gate, no name recorded |

Three details are deliberate. The **username field is absent** in shared mode
rather than left blank, because the page is not asking a question it would
ignore. The rules (**`USERNAME_RULE`**, **`MIN_PASSWORD_LENGTH`**) are passed in
from the server page, the way `/accounts` already hands them to
`AccountManager`, so the hint under a field cannot disagree with the validator
that answers it. And a request that comes back **`approved`** — only reachable as
the bootstrap, or as an admin — signs the person straight in, because there is
nothing to wait for in that case.

### Making "ask for an account" reachable without a session

Part 30 built the queue but left `POST /api/users` behind the gate, which meant
the people the feature exists for could not reach it: you had to be inside to
ask to come in. Three changes make the public path safe without opening the
gate:

1. **Middleware lets exactly one request through** — `POST /api/users`, with the
   GET on the same path still gated (verified: `307 → /login?redirect=%2Fapi%2Fusers`).
   It is also no longer the door: what that request can produce is decided in the
   route.
2. **The one outcome that grants is re-checked** — `accountCreationDecision`
   returns `because: "bootstrap"` when the database is empty, and that is a
   **live admin**. Reachable anonymously it would let a stranger claim a fresh
   deployment, so the route now requires the **shared gate** for exactly that
   case (`hasSharedGate()` in `lib/session.ts`). Everything else a stranger can
   create is a `pending` row, which cannot sign in.
3. **The public path is throttled and finite** — `lib/rate-limit.ts` (below) and
   `guardRequestAccount`, because an unthrottled public endpoint that writes rows
   is a way to fill an admin's queue. Every attempt counts, not just the failed
   ones: a queue is filled by successes.

**`lib/rate-limit.ts`** is the login route's private sliding-window limiter,
extracted because the second public endpoint needed the same thing and two
copies of a rate limiter would drift — the copy nobody touched being the one
guarding the newer hole. It is unchanged in behaviour (in-memory, per-process,
`Date.now` injectable so tests do not sleep) and now shared by `/api/login` and
`/api/users`. `app/api/login/route.ts` lost ~60 lines to it.

### `Status: 429` is not a failed login

The request path's refusal is its **own sentence** — *"Too many account requests
from this address — try again in 60 min"* — and the full queue says how to drain
it (*"Ask an admin to clear the queue"*). Neither is a wrong-password answer,
for the same reason Part 30 gave a pending account its own sentence: the person
is not guessing.

### The history modal: every figure under its own label

The complaint was exact and measurable: in the per-trade footer the label sat at
the left edge and the figure at the right, so **"Realised P/L (USD)" and
`+US$420.00` were about 800px apart**, and pairing them meant reading across an
empty row. The `justify-between` `<dl>` is gone. Each figure is now a **`Metric`
cell** — label, figure, optional second line — in a responsive grid, which is
the same pattern the summary strip and the chart stat rows already use.

**Measured on the live NOW cycle: every label is 4px above its value**, in cells
187–190px wide, at a 896px modal, with **0** inner vertical scroll containers.

What the freed room is spent on is not filler: **Cost basis sold** and
**Proceeds**, the two terms the realised figure is the difference *of*. Before,
the footer asserted a number and gave you nothing to check it against. Now the
live cycle reads `Proceeds US$1,440.00 − Cost basis sold US$1,020.00 =
Realised +US$420.00`, to the cent, and the same for `Avg sell cost · 10 sold`.
The percentage and the SGD equivalent moved into the cell's second line
(`+41.18% · +S$535.92`), so a single P/L cell answers "what, and how much"
without a second glance — and for SG holdings the SGD repeat is dropped rather
than printed beside itself.

### The rename

"Trades" named the ledger after **one of the two things it holds** (every row is
a transaction; a trade is one kind), and it read like a report of completed
trades — which is a different page (*Performance · Realized*). So:

- the Positions tab is **Transactions** (`/positions/transactions`);
- `/positions/trades` **redirects**, so no bookmark, browser tab or shared link
  breaks — verified in the running app, not just in the config;
- the command palette entry is **Transaction ledger** (and still matches
  "trades", which is what people type);
- Today's button is **Log a transaction**, because you can log a sell;
- the ledger column **`Running avg` → `Avg cost`** (the title says "average cost
  basis per share after this transaction"), and `Running qty` keeps its name —
  it *is* the running quantity.

### Verification — against the running app, against the real database

- **The anonymous ask, with no cookie:** `POST /api/users` →
  `201 {"status":"pending"}`; the same name again → `409 "…has already been
  requested and is waiting for approval."`; that account signing in →
  `403 "That account is waiting to be approved by an admin."`
- **The throttle, without polluting anything:** four invalid payloads (refused
  **after** the throttle, before any write) spent the budget, and the sixth
  attempt → `429`. `GET /api/users` → `307 → /login?redirect=%2Fapi%2Fusers`.
- **The flow in the browser, signed out:** *No account yet? Request one* →
  mismatch caught client-side with no request → **"Request sent"** naming the
  username, with *"Nothing is locked while you wait — the shared password opens
  the same dashboard."* The row really was in the queue afterwards
  (`zz-preview-request2 · member · PENDING`).
- **The shared password still works:** `POST /api/login {password}` → **200 with
  a session cookie** (the value read from `.env` inside the script, never
  printed). The mode renders one field and says what it costs you.
- **A signed-in visit to `/login` lands on the dashboard** — middleware now
  sends it onward, which also closes the oddity that an admin could fill in
  "request an account" and silently mint a live one (that is how the first probe
  account in this pass got created, and why the redirect exists).
- **The ledger:** header reads `Date · Action · Ticker · Region · Qty · Price ·
  Running qty · **Avg cost** · Txn value · Note`, tab reads **Transactions**,
  document overflow **0px** at 1440×900.
- **The modal:** the eight `Metric` cells above, plus **0** inner vertical
  scrollers (Part 27's single-scroll-container rule still holds).
- Every probe row was deleted afterwards; the database is back to **one**
  account (`josh · admin · approved`), and all four throwaway scripts are gone
  from the tree.

**Checks:** `npx tsc --noEmit` clean, `npx eslint .` clean, `npm test` **22 files
/ 357 tests** (`tests/rate-limit.test.ts` new — 9 cases pinning the window, the
lockout, the success-reset, key isolation and the sweep; `tests/accounts.test.ts`
+3 for the finite queue), `npm run build` clean with `/positions/transactions`
registered.

**Files:** `components/LoginForm.tsx`, `app/login/page.tsx`, `lib/rate-limit.ts`
(new), `lib/accounts.ts`, `lib/session.ts`, `middleware.ts`,
`app/api/users/route.ts`, `app/api/login/route.ts`,
`components/TransactionHistoryModal.tsx`, `components/TransactionsTable.tsx`,
`components/CommandPalette.tsx`, `app/positions/layout.tsx`,
`app/positions/transactions/*` (moved), `app/page.tsx`, `next.config.js`,
`lib/notes-cleanup.ts` (comment), `tests/accounts.test.ts`,
`tests/rate-limit.test.ts`.

**Known gaps, stated rather than implied:**

- **The bootstrap re-check (`hasSharedGate`) has no automated test.** It is the
  one branch on the public path that grants, and exercising it needs an empty
  database plus a cookie — verified by reading, not by running. That is the
  first thing to pin if the account rules change again.
- **A pending person cannot check their own status** without trying to sign in:
  the shared-password session carries no identity, so nothing can be shown about
  a request in the nav. The login page carries the whole burden of that — which
  is why its copy about approval is specific rather than reassuring.
- The rate limiter is **per process**: a restart forgets it and two instances do
  not share it. Deliberate (see the module header), but it means the throttle is
  a speed bump, not a wall.
- The request queue still has **no notification** — carried over from Part 30.
  The next thing worth building is a line in the nav's account chip when the
  queue is not empty.

---

## Part 32 — Notes become structured (DONE)

*A second pass in the same session, on the same branch, so Part 31 above keeps its
own verification and gaps.*

The owner's request, in their words: each note should state the general action
first — **opened, added, DCA, partial sell, closed** — then more information;
opened needs no average cost (the table shows it), added wants a quick avg
down/up arrow and the new average, closed wants the realised profit, partial
sell wants the fraction and the realised profit, and after that there should be
somewhere to add further notes. Plus the question: *"should these be colour
coded, avg down is green and avg up is red? or will that violate the design
rules of the site?"*

**The answer to the colour question is no, and the reason is not only the rule.**
Colour in this app means *a realised or unrealised gain or loss* — Part 25 put
`tone` on `LedgerLinePart` for exactly that, and an average cost is deliberately
left plain. Colouring an average would put two meanings on one colour in one
column, because red already means "this sale realised a loss" in the same cell.
It would also assert something the ledger cannot know: averaging down is a
*decision*, not a gain, and it is sometimes the wrong one. Direction is a glyph
(`↓`/`↑`), which states the fact without the verdict. The test pins it: neither
arrow, nor the cost beside it, carries a tone.

**The structural change is the one that matters.** The cell used to be
`note.note ?? <LedgerLine/>` — a stored note *substituted* for the derived line,
so the five DCA rows and the four stop-loss/take-profit rows showed no
arithmetic at all. It is now `noteCell(row, symbol, rawNote, subject)`, which
returns the derived line **always** plus the owner's note **appended**:
classification still decides whether a stored note shows (a note that is only the
instrument's name is still suppressed, because the ticker lookup already renders
it), but it can no longer hide a fact. `LedgerLine` renders both halves, the
derived one at 12px `ink-500` and the note at `ink-300`, so which half you are
reading is legible without parsing it.

**The wording, per category** (`lib/notes.ts`):

| row | line |
|---|---|
| buy that opened the position | `Opened` — the average of a position opened by this row *is* the price beside it |
| buy that added | `Added · avg ↓ US$537.33` / `↑`, the arrow comparing `avgCostBefore` with `runningAvgCost` |
| buy with no prior basis | `Added · avg US$600.00` — no comparison, so no arrow (`averageDirection` returns null) |
| sell that left shares | `Partial sell (8 of 15) · +US$156.00` |
| sell that ended the position | `Closed · -US$857.60` |
| sell with no cost basis | `Closed · 3 sold` / `Partial sell (3 of 10)` — never a dangling separator |

**The width, argued from the live column rather than guessed.** Every one of the
64 rows' cells was measured against the actual font (12px Source Serif 4, i.e.
~5.1px/char) with a canvas:

- longest **derived-only** line: `Partial sell (10 of 15) · +US$420.00`, 36
  characters, ~184px;
- longest **DCA** line: `Added · avg ↑ US$157.01 · DCA · Sep 2026`, ~231px;
- the 3 stop-loss/take-profit plans and FLKR's long name: 271–360px, i.e.
  unreachable at any sane column width.

So **16rem** (256px) is the smallest cap that fits every derived line *and*
every DCA month, and it is what shipped. At the old 11rem the derived lines
themselves truncated — the Part 25 problem, one pass later.

The 80px had to come from somewhere, and the table is content-sized, so it came
from `Txn value` (`hidden min-[1400px]:table-cell`): pure arithmetic on two
columns that stay visible, which is the rule this table already applies when it
drops columns on a phone. **The threshold is measured, not chosen:** forcing the
column visible at the widest reachable viewport gives a 1278px table, and the
container is `window − 96px`, so the table needs **1374px** of window and 1400 is
the next round number above it.

**Measured after, in the running app** (ledger, 64 rows, real data):

| viewport | available | table | inner horizontal scroll |
|---|---|---|---|
| 1314 (max the panel reaches) | 1218 | 1218 | **0px** |
| 1168 | 1072 | 1161 | 89px — the same table already scrolled more than this at 11rem |

And with every column forced visible at 1168: table 1278px → a 1374px window is
the true minimum, which is where the 1400 threshold comes from. The column reads
as a taxonomy on the real ledger: **31 `Opened`, 15 `Added`, 13 `Closed`, 5
`Partial sell`** — all 64 rows, none left blank. **5 cells truncate** and all 5
are the notes, never the arithmetic: the three stop-loss/take-profit plans,
FLKR's long name, and `NOW - 1st TP`. In the modal, all of them fit: `Partial
sell (10 of 15) · +US$420.00 · NOW - 1st TP` renders in full.

**Adding a note** is still the ledger's own `Edit` (the note field holds only
your words, and the hint now says where they land: *"Your own words, appended
after the ledger line: Added · avg ↑ US$157.01"*). Clearing it remains possible
without retyping a fact, because the facts were never in the field.

**One honest wrinkle, kept rather than papered over:** the DCA rows read
`Added · avg ↑ US$157.01 · DCA · Sep 2026`, which is right — but a DCA row that
*opens* a position reads `Opened · DCA · May 2026`, where "Opened" earns its
place only as the taxonomy's first word (the average it would have stated is the
price in the next column). If the owner would rather see `DCA · May 2026` there,
that is a one-line rule in `noteCell` and a one-row decision.

### Known gaps

- **Four long notes still truncate** in the ledger (three stop-loss/take-profit
  plans and FLKR's name), and that is a width decision, not a bug: fitting a
  64-character note needs a 22rem column, which would cost a column that carries
  information no one can recompute. The full text is one hover away, and the
  facts in front of it are never the part that gets cut.
- **`DCA` is still a text convention**, not a stored kind — so a DCA row is
  recognised by its note text, and a typo in that text is a mis-classification.
  The owner asked about a `kind` column during the re-prompt and the answer was
  "not yet"; this is the first place it would pay.

---

## Part 33 — a DCA says DCA, a search box you can find, and the text pass on
Returns & risk (DONE)

Six fixes from the owner in one message. They divide into one behavioural change
(DCA), three UI corrections, and two passes over text.

### 1. A DCA buy says DCA — and the marker is still just a word

The owner: *"for DCA buys, the notes should read: DCA (Sept 2026) · avg up
US$xx. no need for 'added'"*, and separately: *"under log a transaction, add the
checkbox option for DCA buy, to recognise when to use 'DCA' instead of
'added'"*.

So the action word itself changes, which is the one thing Part 32 left open. The
five real DCA rows already carried `DCA · May 2026` (the notes cleanup put them
there), and the ledger now renders them as facts:

| row | reads |
|---|---|
| DCA that added to a position | `DCA (Sep 2026) · avg ↑ US$157.01` |
| DCA that opened it | `DCA (May 2026)` — no average, because the Price column is the average |
| DCA with something written after it | `DCA (Sep 2026) · avg ↓ US$151.52 · temp verify` |

**The month is the note's if it names one, otherwise the row's own** —
`formatMonthYear(row.date)`, so a DCA logged with the checkbox and nothing typed
still reads `DCA (Sep 2026)`, and editing the date later cannot leave a stale
month behind. That is the same "derive, never store" rule the rest of the column
follows.

**The storage cost is zero.** The checkbox composes the note the form already
sends — `DCA` or `DCA · <whatever you typed>` — and `dcaFromNote()` recognises a
note whose **first word** is the marker. Three consequences are deliberate:

- A note that only *mentions* a DCA (`VT - Monthly DCA ($865)`) is not a marker.
  The marker is leading, because that is what the form writes and what the
  cleanup left in storage; reading it anywhere in the note would eat sentences
  the owner wrote by hand.
- A note with non-month words after the marker keeps them:
  `DCA · Brought forward` → `DCA (Sep 2026) · avg ↑ … · Brought forward`.
  Dropping them would be data loss, and `noteCell`'s asymmetry is the same one
  Part 25 established.
- A marker on a **Sale** is ignored, and the form's checkbox is hidden on a sale.
  A scheduled-buy marker on a sale is a note about something else.

### 2. Three UI corrections

- **The command palette lost its gold top edge.** Two classes
  (`border-t-2 border-t-accent`); the owner's word was "jarring", and the comment
  now records why it is gone rather than leaving the next reader to re-add it.
- **The nav's search affordance is findable.** It was a 12px ghost button reading
  `⌘K`/`Ctrl K` with a 13px icon — present, but easy to read as chrome. It is now
  a filled chip at the bar's own text size (14px) reading **`Search… Ctrl K`**,
  measured **146×34** against roughly **85×26**. The label drops out below `sm`,
  where the icon still carries it.
- **`Add account` left Today.** The button was admin-only but on the page whose
  rule is one snapshot, and adding an account is not a daily act — `/accounts`
  (reachable from the nav's account chip) still owns it, and the attention line
  for a **waiting** request stays, because that one is time-sensitive. The
  username example is now `josh`.

### 3. The watchlist explainer was a CSS bug, not a layout opinion

The owner: *"'how to read these' expanded dialog box is broken, text overflows on
the right side. try to make it a in a grid shape (2x2)"*.

Both halves were real, and the first was worse than it looked. The expanded cell
carried `whitespace-normal`, with a comment claiming it reset the table's nowrap
— but `.ledger-table td` sets `whitespace-nowrap` in the **same `@layer
utilities`**, and its selector (`.ledger-table` + `td` = 0-1-1) outranks the
plain utility class (0-1-0). Measured before the fix: `white-space: nowrap` on
the cell, four `dd`s of 1183px each with `scrollWidth` 1954–2543 — **the prose
was one line 2559px wide inside a 1215px box.**

This is the third time this codebase has hit the same trap (`.field`'s `w-full`,
`.panel`'s border, `.ledger-table`'s own z-index), so the fix is the pattern the
file already had for it: a real selector in the layer,
`.ledger-table td.cell-wrap { white-space: normal }`, next to `.cell-pin`. The
four measures are then a **2×2 grid** (`sm:grid-cols-2`, `gap-x-8`), which is the
owner's request and also the right reading: they are four answers to one
question, not four paragraphs. Measured after: columns 575.7/575.7px,
`scrollWidth == clientWidth == 1215`, 0 document overflow.

### 4. The text pass on Returns & risk

Owner: *"evaluate all the text and see which points are necessary and which are
not. for explanations of technical terms, be concise and simple to understand."*
The rule applied: a hover that explains a term keeps one clause; a sentence that
narrates the app's own data hygiene or repeats a date goes.

| where | before | after |
|---|---|---|
| XIRR tooltip | "Accounts for WHEN each contribution landed, so it moves with the deposit schedule." | "Money-weighted: counts when each contribution landed." |
| TWR tooltip | "Contribution timing removed, so this reflects the strategy rather than the deposit schedule." | "Time-weighted: deposit timing removed, so it reflects the strategy." |
| Volatility | "Standard deviation of daily returns, annualised. An estimate — read it with the rolling line below." | "How much the daily value swings, annualised." |
| Max drawdown | "The worst peak-to-trough fall in the stored daily values." | "The worst fall from a peak to the trough that followed." |
| Holdings value | "The base every concentration figure below is a share of." | "What the concentration figures below are shares of." |
| Concentration footer | "Holdings only, not cash — cash lowers the portfolio's risk but it is not a position. HHI: …" | "Holdings only, not cash. HHI: …" |
| Largest single day | "… that one day carries 29% of the variance above, so if the snapshot behind it looks wrong, this is why the risk figures read high." | "… on its own it explains 29% of the volatility above." |
| Rolling footer | "The trailing year's return, recalculated daily — a single cumulative number hides an uneven year. Starts 02 Mar 26, the first day with a full year behind it." | "The trailing year's return, recalculated each day. Starts 02 Mar 26 — the first day with a full year behind it." |
| Value chart footer | "Value change, not return — S$45.9k of it is deposits paid in over this window, and S$9.5k is the market." | "Value change, not return — S$45.9k deposits in, S$9.5k from the market." |
| Benchmark subtitle | "Both rebased to 100 at 2 Mar 2025 · 2 Mar 2025 – 23 Sep 2026" | "Both lines start at 100 · 2 Mar 2025 – 23 Sep 2026" |

**Kept, because they are the page's glossary and it had none:** the XIRR/TWR
line under the heading, `Effective N` ("1/HHI — behaves like this many equally
sized positions"), the HHI bands, the correlation legend, and
`Time-weighted: money added during the year does not count as growth.` The
distinction drawn while cutting: **a term the reader may not know stays; a
sentence about the app's own snapshots or a date printed twice goes.**

### Verification

- `npx tsc --noEmit` clean, `npm run lint` clean, `npm test` **22 files / 376
tests** (10 new: `dcaFromNote` incl. the five stored notes, the DCA line, the
month fallback, words kept after the marker, and a sale's note not being a
marker), `npm run build` clean.
- **Live, on the real ledger** (64 rows): the five DCA rows read as above, 0px
document overflow.
- **Live, the write path, end to end:** a VT buy submitted with the box ticked
  and `temp verify` typed stored `DCA · temp verify` and rendered
  `DCA (Sep 2026) · avg ↓ US$151.52 · temp verify`. The probe row was deleted
  afterwards — the table is back to **64 rows**.
- **Live:** the box appears for Buy and disappears on Sell; the palette opens with
  no gold edge; Today shows no `Add account` as an admin; `/accounts` shows
  `e.g. josh`; the explainer is 2×2 with `scrollWidth == clientWidth`.

### Known gaps

- **The row editor has no DCA checkbox.** The owner asked for it on the log form;
  the ledger's `Edit` still marks a DCA by the note's first word, and its hint now
  says so ("Marks this buy as a DCA — the ledger shows it as: DCA (May 2026) · avg
  ↑ US$157.01"). Half an hour of work if the owner wants it symmetric.
- **The four long notes still truncate** (Part 32's gap, unchanged).
- **`DCA` is still a text convention**, so a mistyped marker is a
  mis-classification rather than a validation error.

---

## Part 34 — a table per market, and the exposure tag list's dead space (DONE)

Three requests in one message: *"stack values vertically to aid comparison"*,
*"could we possibly put multiple regions on the same page, since we reduce the
number of columns"*, and *"the tag the holdings section under exposure also has
too much empty space"*.

**It took a correction, and the correction is the useful part.** The first pass
read "multiple regions on the same page" as one table with a `Region` column:
eleven columns of figures in eight, one sort, one set of totals in SGD. The
owner's reply on seeing it: *"this is not quite what i imagined… i still want
separate tables for each region, just placed side by side."* One table can HOLD
three regions; it cannot show them as three blocks, and sorting it by value
interleaves them — which is the comparison the page exists for. Same page, three
tables, three headings.

### The two questions the request left open, and how they were answered

Asked before building, because both change what the page MEANS rather than how it
looks:

1. **Are the rows in one currency, or in three?** Chosen: **native per row, and
   each region's heading total also native** — only the page's two headline figures
   are converted to SGD, and the page says so. Adding HK$ to S$ to US$ is not a
   number, and converting every row would put the FX rate's daily move into figures
   that are supposed to describe the holding. `getOpenPositionsFor` already returns
   both halves per row — native `totalHoldings`/`unrealizedPL` and SGD-converted
   `…Converted` — so the region heading sums the native one and the stat row keeps
   the converted one.
2. **Does a stacked cell lose its second sort?** Chosen at the time: **yes, the
   header sorts the primary and says so in its `title`.** `qty`, `avgCost` and
   `unrealizedPLPct` lost their `GETTERS` entries; `value`, `price` and `P/L` kept
   theirs. The alternative — a header that toggles between its two figures — was
   rejected as more chrome than the ordering of a secondary figure is worth.
   **That judgement was reversed in Part 35**, on the owner asking "is it possible
   to sort by the secondary row in the table?": the toggle is back, and the chrome
   it was rejected for is paid for by the header's own LABEL, which changes to name
   the figure in charge (`Value` → `Shares`) rather than by an extra control.

### The holdings page (`app/positions/holdings/page.tsx`, `components/PositionsTable.tsx`)

Five columns, each cell a PAIR of figures — the number you compare on top, the one
that explains it underneath, both right-aligned so the digits line up down the
column — and that pairing is what makes five columns do the work of nine:

| column | primary | beneath it |
|---|---|---|
| Holding | ticker | the instrument's name, capped at 9rem |
| Value | total holdings, native | `245 shares` |
| Price | current price, native | the average cost paid, unlabelled — both quantities, neither coloured |
| P/L | unrealized P/L, native | its percentage |
| Portfolio % | this holding's share of the whole portfolio | how long it has been held |

**Both figures in a pair are sortable, and the header names the one in charge.**
The four paired headers cycle `primary ↓ / primary ↑ / companion ↓ / companion ↑`
and the LABEL changes with the state — `Value` becomes `Shares`, `Price` becomes
`Avg cost`, `P/L` becomes `P/L %`, `Portfolio %` becomes `Held` — so one control
per column answers "sort by the second row" without adding chrome. `Holding` has a
single state pair (ticker asc, then desc): its companion is the instrument's NAME,
reference text rather than a figure to rank by. The states live in one `COLUMNS`
array (each with the label it shows), the getters in `GETTERS`, and `advance()`
updates from the PREVIOUS state rather than the captured one, so two clicks in one
tick advance twice instead of landing back where they started.

The fifth column was spent on the holding period rather than the sparkline. The
period had no home of its own and rode at the ticker's right end at `text-[10px]`,
where it read as detached from the row's figures; paired under the portfolio share
it is a fact about the position, sitting beside another one. The 30-day sparkline
(and its batched `/api/sparklines` request) is the one thing that did not come
back. `Portfolio %` is the share of the WHOLE portfolio — a region's own share is
in its heading — because the cross-region share is what the side-by-side
arrangement is for. An unpriced holding renders ONE `N/A` rather than stacking the
word twice.

**Layout is measured, not chosen.** The five-column floor is **~560px** at a 1296
viewport (the figures alone are 269px, the ticker 156px, `Portfolio %` 66px, and
the outer columns carry 12px of padding instead of the ledger's 8px). From that:

| viewport | arrangement |
|---|---|
| ≥ 1800px | three tables, no arrows (the wrapper goes `contents`, three equal columns) |
| 1220–1799px | two columns — US | SG with HK tucked underneath, no arrows |
| < 1220px | one table per view, arrows slide the strip |

The tuck is the owner's preference made concrete: show a market rather than hide it
behind an arrow, and fall back to the strip only when two five-column tables no
longer fit. It costs visible blank space, and the cost is stated rather than
hidden — US is capped at 70vh while SG + HK come to a few hundred pixels, so at
1296 the left panel measured **600×635** against the right column's **600×444**.
One DOM serves all three arrangements: the wrapper around SG and HK is `contents`
below 1220px (the track then sees US, SG, HK as siblings and snaps one at a time)
and `contents` again from 1800px (three equal columns), and is a real box only
between the two widths, which is exactly the tuck.

The arrows are driven by `scrollWidth` vs `scrollLeft`, not by the breakpoint, so
they vanish when everything fits and cannot offer a table that is already on
screen. The strip is `tabIndex=0` with `role="group"` so the keyboard scrolls it,
it snaps one panel at a time, and `prefers-reduced-motion` makes the slide a jump.
Two helpers in `globals.css` carry the width rules: `.table-region` (drops the
ledger's `min-w-[720px]`, which would otherwise make a third-width table scroll
inside its own panel) and `.cell-pad-start` / `.cell-pad-end` (a real selector,
because `.ledger-table td` at 0-1-1 outranks any padding utility — asked for as
"more padding on the first and last entries", and the naive `pl-3` silently does
nothing).

The three region routes are gone; `/positions/us|sg|hk` and `/holdings/us|sg|hk`
are config redirects to `/positions/holdings` — config rather than stub pages
because only `redirects()` forwards the `?ticker=` query the command palette
deep-links with. The region rules are listed BEFORE the generic
`/holdings/:path*` rule so a bookmarked region URL is one hop, not two. The
`?ticker=` link still lands correctly in all three arrangements: in the two- and
three-column layouts everything is on screen, so only the row is centred; in the
one-column strip the row's own table is slid into view first. Verified live at a
1077 viewport: `?ticker=01810` scrolled the strip to the HK panel (`scrollLeft`
2027, panel fully visible) with the Xiaomi row rendered highlighted. The tab strip is `Holdings · Exposure · Transactions` (one tab, a
`Briefcase` icon, where three flags used to be), and the palette lost its
`Positions · SG` / `Positions · HK` entries while keeping the region words as
keywords.

### The tag list (`components/SectorTagEditor.tsx`)

Three earlier templates are the history here, all recorded in the file, because
each looked reasonable in the code and wrong on the screen. An instrument column
of `1fr` grew to ~690px so a row read `name …… S$19,061.00`. Capping it at 20rem
fixed that but handed the `1fr` to the tag column, so every row ended with a chip
and then several hundred pixels of nothing. Giving the slack to a **weight bar**
fixed that and is still how the row is built — the list is ordered biggest
holding first, and a length compares down a column where "30.7%" does not.

What it did not fix is the HEIGHT: eighteen rows of one column each. So the list
now runs **two holdings per line from `xl` up**, with the odd/even halves padded
equally (20px each, a rule between them) so both halves are the same width and
their figures line up. Type — one word in a 4rem column — moved onto the ticker's
line at the instrument cell's right edge, which is what pays for the second
column; the four tracks left are `instrument | value | weight | tag`.

Measured at a 1235px content width (1314 viewport): the panel is **656px** where
it was 1120px, and the page is **1252px** where it was 1716px — 464px off the
page. Each half measured 597px wide with its own grid at 176 · 88 · 89 · 176, no
document overflow, and the doubled label row appears only from `xl` (below that
there is one column of rows and one label row, as before). The bar's track is
`ink-700` rather than the `ink-800` the app's shorter bars use, because at this
length an `ink-800` track is invisible against the panel and 18 gold ticks
floating in nothing is the same void in a new place. On a phone the bar stays
`w-24` beside the type instead of taking a line of its own, which would have
added a line to all 18 rows on the layout that can least afford it.

### Verification

- `npx tsc --noEmit` clean, `npx eslint app components lib tests scripts` clean,
  `npm test` **24 files / 404 tests** pass, `npx next build` clean. (`npm run
  build` runs `prisma generate` first, which fails with `EPERM` on
  `query_engine-windows.dll.node` while the dev server holds the generated
  client open — an environment artefact of testing with the dev server up, not a
  code problem. `npx next build` is the check to use while it is running.)
- **Holdings, live.** Columns per table: `Holding · Value · Price · P/L ·
  Portfolio %`. At a **1296** viewport (the tuck): the track is 1217px with two
  children — US at 600×635 and the wrapper at 600×444 — tables 583 / 599 / 599,
  `scrollWidth == clientWidth` in all three, 0px of document overflow, no arrows.
  At **1962** (three across, the wrapper `contents`): three columns of 617 / 615 /
  615, tables 600 / 615 / 615, still no arrows and no inner overflow. At **1780**,
  just under the 1800 threshold: the tuck again, two columns of 842px, the tables
  far above their floor. At **1077** (below 1220): the track sees three siblings of
  998px, scrolls 2027px, arrows present with `prev` disabled until the deep link
  slid it to HK.
- **The sort cycle, live, on the US `Value` header.** `Value` (descending — VOO
  first) → `Value` ascending (NOW first) → **`Shares`** descending (B, 75 shares) →
  `Shares` ascending (VHT, 5 shares) → round again, the label following the state
  each time. The tables do not share a sort: after sorting US, SG still read D05
  first under its own `Value` header. `Portfolio %` keeps its label through its
  first two states, as designed.
- **Padding, measured:** first column `padding-left: 12px`, last column
  `padding-right: 12px`, middle columns 8px — asked for as "a bit more padding on
  the first and last entries", and delivered by selectors rather than utilities
  because `.ledger-table td` outranks one.
- **Phone (356px):** the document is 340/340 (no sideways drag), one panel per
  view at 277px, each table scrolling 185–217px inside its own container — the
  ledger's established phone behaviour, now with far less to scroll than 8 columns
  needed.
- **Tag list, live:** 18 rows in 9 lines from `xl`, two halves at x 53 and 650 with
  identical grid templates, panel 656px (was 1120px), page 1252px (was 1716px),
  0px of document overflow at 356 / 935 / 1314. One-up below `xl` (935: 18 rows,
  bar 325px, one label row); at 356px the rows are the flex layout, 118px tall,
  bar 48px, headers hidden as before.

### Known gaps

- **The tuck leaves the right column short.** At 1220–1799px SG + HK stack to a
  few hundred pixels beside a US table capped at 70vh, so the page is as tall as
  its tallest table and the second column ends in blank space. The owner's trade,
  made knowingly: a visible market is worth the gap, and an arrow-click is worse.
- **The 30-day sparkline left the holdings page**, and with it the batched
  `/api/sparklines` request that page used to make. It is still on Today's largest
  positions and the watchlist. This pass's fifth column went to the holding period
  instead; a per-row sparkline would be a sixth, worth roughly 95px more of floor
  (~655px), which pushes three-across past 2100px.
- **Sorting is per table, by design.** There is no global sort: a `Region` column
  is exactly what the side-by-side arrangement replaced. Nobody has asked for a
  different market order than US, SG, HK.
- **`Portfolio %` is the whole portfolio's share**, not the region's. A region's
  own share is already in its heading, and the cross-region share is what the
  arrangement is for; the other reading is one line in `GETTERS` if it is wanted.
- **The phone still scrolls a region's table sideways** (185–217px at 356px), and
  each region's table scrolls its own rows vertically at 70vh. A layout that fits
  a phone would have to trade figures away, which is a decision not yet asked for.
- **Unpriced rows** (some HK tickers) show `N/A` for P/L and are held at cost, as
  before; a region's heading now says `N at cost` beside it, and the page's notice
  still says the totals understate.

---

## Part 35 — the fifth column, a sortable second row, and HK tucked under SG (DONE)

Three requests in one message, all of them about the holdings page's shape after
Part 34 had shipped:

> *"the held period looks unnatural, what if we add a portfolio % column and stack
> it with holding period? also, if there is space under the sg table, can we try to
> place the hk table under it first before resorting to the carousell? also, is it
> possible to sort by the secondary row in the table?"*

The first clause names a symptom and guesses a cure, which is worth separating:
"unnatural" is not a complaint about the holding period, it is a complaint about
where it sat. It rode at the ticker line's right end at `text-[10px]`, at the far
side of the widest cell in the row from the figures it belongs to, so it read as
loose text rather than a fact about the position. Putting it in a column of its own
is the fix; pairing it UNDER something is what stops the column being one short
string floating in whitespace, and `Portfolio %` is the natural partner — both are
facts about the position rather than about its price.

### The two questions asked before building, and the answers

1. **What does the tuck replace?** Chosen: **arrows only below ~1215px, HK under
   SG from there up.** The alternative read as "tuck only while HK fits beside" —
   i.e. keep the strip whenever SG and HK do not both fit, which is the carousel
   this request is trying to escape. As built, the tuck runs 1220–1799px and three
   across from 1800px.
2. **`Portfolio %` of what?** Chosen: **the whole portfolio.** The alternative —
   the holding's share of its own region — is closer to the neighbouring figures,
   which are all native to the region, but it answers a question the region's own
   heading already answers, and the cross-region share is the one the side-by-side
   arrangement exists to make visible.

### What shipped

In `components/PositionsTable.tsx`, the sort model was replaced outright. `GETTERS`
now carries all nine keys (`qty`, `avgCost` and `unrealizedPLPct` came back), a new
`COLUMNS` array holds each column's cycle of `{ key, dir, label }` states, and the
header renders `COLUMNS` — `label={isActive ? sort.label : column.label}`. One
click per state, four states per paired column, the label changing on the third
click to name the figure that is now ordering the rows. `useSortable` is no longer
used here (it is still used elsewhere). `advance()` updates from the previous
state rather than the captured one, so two clicks in one tick advance twice
instead of landing where they started.

The layout is two Tailwind constants and one wrapper. `PANEL` is the panel's own
geometry; `TUCK` is
`contents min-[1220px]:flex … min-[1800px]:contents`, and the `contents` at both
ends is the whole trick — below 1220px the track must see US, SG and HK as three
siblings so it can snap one at a time, and at 1800px it must see three columns, so
in both cases the wrapper stops generating a box and its children join the track's
layout directly. Only between the two widths is it a real element: a column with
SG above HK. The track's children are written out literally rather than mapped,
because that DOM order is what all three arrangements depend on.

The holding period left the ticker line, the `Holding` header lost its second
state (its companion is the instrument's name), the P/L cell gave up
`cell-pad-end` to the new last column, and the empty state's `colSpan` went from 4
to 5. `TickerName`'s cap came in to `max-w-[9rem]` for the narrower cell, and the
new cell is `PlainPercent` over `formatHoldingPeriod` in `text-xs text-ink-500`,
the share neutral because a quantity is not a result (DESIGN.md §2).

### Verification

The measurements, the sort cycle as observed live, the breakpoint table and the
tuck's accepted blank space are in **Part 34's** `### Verification` and
`### Known gaps` above, which now describe the shipped shape — the two sections
were rewritten in this pass rather than left to contradict each other.

Docs touched: this file, `README.md`'s Positions paragraph, `docs/DESIGN.md` §5 (a
new bullet on a sortable pair, the floor and `.table-region` updated to five
columns) and §7 (the carousel bullet now says a tuck beats the carousel and states
its price), and two stale "four columns" comments in `app/globals.css`.

---

## Part 36 — flags, sort dots, and the exposure page's two columns (DONE)

Four requests in one message:

> *"re-design and bring back the country flag svgs. add 4 dots under the header to
> indicate which level of sort i am at (value descending is first, value ascending,
> shares descending and then shares ascending) for exposure, put the donut graphs
> on the left and the holdings table on the right. for the sector hovering
> animation on the donut, i prefer more of a emphasize style (enlarge sector and
> dim others)"*

Rewritten before building (the re-prompt pass) because two of the four name the
solution rather than the problem: "4 dots under the header" is a fix for a sort
cycle that does not describe itself, and "bring back the flag svgs" is a fix for
three markets whose headings no longer announce which market they are. Both were
built as written, with two decisions taken first — flags on the region HEADINGS
(not the tabs Part 34 removed), and the dots on the active header only.

### The flags

`components/RegionFlag.tsx` had been unused since Part 34 took the region tabs out,
and it survived with the note that already answered this request: "for use beside a
HEADER label — never inside a table, where it would just add visual noise to a
dense row". The region headings are header labels, so the component went back, and
it was redrawn on the way (four things, all of them about 16px):

- a hairline edge in `ink-700`, the app's own border colour, because a light field
  against a dark panel ended in a soft antialiased boundary and looked smudged;
- `shapeRendering="crispEdges"` on the US stripes only — at ~1.6px each they were
  blending into a pink-red mush, and the curves keep smooth rendering because
  snapping a 2px circle to the pixel grid makes it a square;
- the canton at 40% of the width, which is the real flag's ratio rather than the
  45% the first draft used;
- Hong Kong as a flower rather than a disc. A red field with a pale circle in the
  middle is Japan's flag, which is what one circle read as; five petals around a
  centre is the bauhinia, and it is distinguished by shape rather than by
  remembered colour.

### The sort dots

`SortableTh` gained a `level` prop and `PositionsTable` passes it for whichever
header is active, built from `COLUMNS[column].states` — the same array a click
advances through, so the dots cannot drift from the cycle they describe. Four dots
on a paired column, two on `Holding`, none on a header that is not sorting. The
level is in the button's accessible name ("Value, level 2 of 4, ascending") and
`aria-sort` went on the `<th>`; the dots themselves are `aria-hidden`, because the
state must not be carried by four small filled circles.

The cost is real and was accepted: the dot row is ~12px of sticky header on each
table, and the tables are already capped at 70vh.

### The exposure page

The three donut panels now stack down the left in a 32rem column with the tag list
beside them from 1280px up. 32rem is what the donut card needs on its own terms —
a 192px ring plus its gap leaves the legend ~264px, which is a sector name and its
two figures — and 1280 is where both columns can be honest at once: the list wants
~560px of panel, the chart column wants 512, and the gutters make up the rest.
Below 1280 the page is exactly what it was (two chart panels across the top, the
list full width underneath).

Two consequences, both measured rather than assumed:

- **The tag list's two-up threshold moved from `xl` to `min-[1820px]`.** In the new
  column the panel is `viewport - 607px`, and two rows side by side need 1208px, so
  1820 is where the second column of holdings comes back (measured at a 1962
  viewport: halves of 656px, rows 9 lines, panel 656px tall). On a 1440 laptop the
  list is therefore 18 rows rather than 9, which is the price of the arrangement
  the request asked for.
- **The donut's ring and legend stack** from `xl`, because in a 470px card the
  legend would otherwise have ~260px and every longer sector name would truncate.
  Stacked, the legend reads as a narrow table across the whole card, and the chart
  column grows into the height the tag list already had (the left column measured
  870px against the list's 1142px, where unstacked it was 612px against 1142px).

**Container queries are not available here, and that is worth recording.** The
honest fix for a panel whose width no longer follows the viewport is
`@container`, and Tailwind 3.4 is supposed to ship it — but in this tree neither
`@container` nor `@[35rem]:grid` compiles to anything, verified by running the CLI
against a probe file with those exact classes and getting `.flex` and `.gap-4`
back and nothing else, and by `container-type` appearing nowhere in
`node_modules/tailwindcss`. So the thresholds are viewport numbers with the
arithmetic written next to them, and TEMPLATE's comment says which page geometry
they are coupled to.

### The hover

Sectors grow by 6px under the pointer and everything else drops to 0.35 opacity,
legend included, from one number in one component. Three details are structural:
`Pie`'s `shape` is used to draw each sector (Recharts 3 deprecated `activeShape`
in favour of `shape` + `isActive`), the ring is drawn at 90% of a 192px box so the
growth has somewhere to go instead of being clipped by the SVG edge, and the
pointer leaving the BOX is what clears the state — a per-sector `mouseleave` fires
between two adjacent slices, which is a flicker between two states rather than
none. `.donut-slice` carries the `fill-opacity` transition, off under
`prefers-reduced-motion`, since a radius on a path cannot be eased.

### Verification

- `npx tsc --noEmit` clean, `npx eslint app components lib tests scripts` clean,
  `npm test` **24 files / 404 tests**, `npx next build` clean.
- **Live, holdings.** Three flags on the page (one per region heading). The US
  `Value` header carried `aria-sort="descending"` and dots `F o o o`; a click gave
  `Value, level 2 of 4, ascending` with the order flipped (NOW first), another gave
  `Shares, level 3 of 4, descending` with `o o F o` (B first, 75 shares), and the
  `Holding` header showed two dots and no `aria-sort` on the others. Every header
  cell measured 49px tall.
- **Live, exposure.** At a 1296 viewport: a 512px chart column beside a 689px tag
  panel, both donuts stacked (444px and 410px) with the legend 470px wide, rows a
  grid of `176 / 88 / 159 / 176 / 0` at 52px each, 0px of document overflow, page
  1397px against 2115px for the stacked layout. At 1962: the list two-up (halves
  656px). At 1077: the old arrangement exactly — two 491px chart panels side by
  side with the ring and legend back in a row, the list full width beneath. At 356:
  three panels at 277px, rows in the wrapping flex layout, no sideways drag.
- **Live, hover.** Hovering slice 1 grew it to a 68px bounding box from 62px, set
  the other five slices in that ring to `fill-opacity: 0.35` (the currency donut's
  three were untouched, being a separate component with its own state), dimmed the
  matching legend row, and faded the centre total; leaving the box restored all of
  it.

### Known gaps

- **The tag list is one row per holding on most desktops** (see above). Two-up
  returns at 1820px; the template itself is unchanged.
- **The dots add height to every table's sticky header** (~12px), and they exist on
  one header at a time — the other four columns keep the plain chevron.
- **The flags are not the flags' colours.** They are muted palette tones by design,
  which is the same rule the rest of the app follows; a reader looking for
  saffron-and-blue will not find it.
- **The hover does not work from the legend.** Pointing at a legend row dims
  nothing and enlarges nothing; only the ring is a hover surface.
- **The chart column's height is not balanced with the list.** The list is the
  taller of the two at most widths, so a few hundred pixels of the left column are
  empty below the currency card. Same class of trade as the holdings tuck.

---

## Part 37 — the donut's tooltip goes, and the tag list's phone rows (DONE)

Three asks in one message:

> *"the popup on hover feels unnatural, like its getting in the way. maybe do away
> with the text box and just change the inner text on hover? also, on mobile, the
> tagged holdings table looks very unorganised. the 'fund' and 'stock' labels look
> out of place. maybe fix it, and put the tag inline with the percentage?"*

### The readout moves into the ring

`Tooltip` and `DonutTooltip` are gone from `ExposureDonut`. A panel that tracks the
pointer sits between the pointer and the thing it describes, and at 192px of ring
it covered the hole and both neighbouring sectors — the complaint was about the box,
not about reading the numbers. Every figure the box carried was already in the
legend, so the CENTRE of the ring became the readout: while the pointer is on a
sector, the hole shows that sector's name (10px, allowed to wrap to two lines),
its value, and its share, then reverts to the total on leave. Measured on the
widest current label: 99px + 72px + 30px of text in a hole with 103px of usable
width and ~127px of height, so the three lines fit with room to spare.

The emphasis stays as it was (the sector grows 6px, everything else drops to 0.35,
legend in step) and now there are three things reading one `active` number — ring,
hole and legend — so none of them can disagree about which slice is the subject.

**The one thing the box carried that the hole cannot fit is the per-slice holding
count.** It left the UI with the tooltip; nothing else on the page shows it. If it
is wanted back, the legend row is the place for it (the hole is ~103px of usable
width and the count is another 12 characters).

### The tag list's phone rows

At 356px a holding read as four loose lines: the type label ("Fund", "Stock")
floated in the middle of the first line, and the tag chip took a line of its own for
about 90px of content. Both had the same cause — the row is a five-track GRID from
`md` up and a wrapping FLEX row below it, and two of the grid's devices do nothing
without the grid:

- the type label is `ml-auto` inside an 11rem instrument COLUMN on a desktop, which
  is what lines the labels up in their own column down the list; in a flex row with
  no column to align to, it hung in the gap between the ticker and the value. Now it
  is `md:ml-auto`, so on a phone it sits against the ticker (`S63 Stock`) — where
  its alignment means nothing because there is nothing to align with.
- the tag cell was `basis-full`, which guaranteed it its own line. In the flex row
  it is now content-sized, so the chip rides the line the weight bar is already on —
  which is also what the request asked for ("put the tag inline with the
  percentage").

Measured at a 420 viewport (a 262px row): the row is 94px tall — one line shorter
than the 118px Part 34 recorded for the flex layout at a NARROWER 356 viewport — the
type label sits 30px after the ticker instead of at the row's midpoint, and the
chip's cell is 93px of content rather than the full width. Desktop is unchanged: the
type is still at the right edge of its 11rem track and the chip still sits in its
own 11rem column.

### Verification

- `npx tsc --noEmit` clean, `npx eslint app components lib tests scripts` clean,
  `npm test` **24 files / 404 tests**, `npx next build` clean.
- **Live, the readout.** No `.recharts-tooltip-wrapper` in the DOM any more.
  Hovering a sector put `US Broad Market / S$9,043.82 / 14.6%` in the hole (its
  label measured 99px inside a 103px usable width) and left the total in place for
  every other sector; leaving the box restored `TOTAL / S$61,746.77`.
- **Live, the phone.** At a 420 viewport a row is two-ish lines — ticker with its
  type, then the bar with the percentage and the chip after it — and at 356 a long
  tag (`Industrials & Defence`) still wraps to a line of its own, which is the one
  case the request cannot have: the chip is wider than the space left beside the
  percentage on that screen.

### Known gaps

- **The per-slice holding count has no home** (see above).
- **A long tag still takes its own line on a phone**, for the reason above; the
  chip is 12px type with its own padding and cannot shrink further without
  disagreeing with every other chip in the app.
- **The hole's readout is not reachable on touch**, where there is no hover — the
  legend carries the same figures, so nothing is lost, but the emphasis and the
  readout are a pointer affordance.

---

## Part 38 — exposure on one screen (DONE)

One request, four instructions:

> *"make the exposure tab sit on the page without scrolling. eliminate the
> unnecessary sentence at the top. make the table a fixed size and scrollable. the
> end result should be a grid-like layout on the screen, clean and
> compartmentalised."*

### The height arithmetic

From `xl` the grid is `xl:h-[calc(100dvh-13.5rem)]`. `13.5rem` is 216px, which is
the chrome above this page MEASURED at a 1296px width rather than guessed — the
nav, the "Positions" label, the section tabs and the container's padding — and all
four are width-independent, so one number holds across desktop widths. At a 900px
window (an 821px viewport in the preview) the grid is 606px, starting 183px down
and ending 33px above the bottom edge: `document.scrollHeight == innerHeight`,
which is the whole point.

### The sentence, and where its meaning went

The first line of the page was *"Holdings only — 18 positions, S$61,759.05. Cash is
excluded: it has no sector."* — the owner's "unnecessary sentence". It was doing two
jobs: the scope (holdings, never cash) and a total that the ring already draws in
its centre. The total was pure duplication; the scope mattered, so rather than
dropping it the sector view's `centerLabel` became **`Holdings`** (the type view had
said that since it was written). The ring now reads `HOLDINGS / S$61,759.05`, which
is where a page of panels should state its scope: on the figure, not above it.

### The table: fixed height, scrolling rows, pinned labels

The right panel is `xl:min-h-0` with `overflow-hidden`, and `SectorTagEditor` fills
it: its root is `xl:flex-1 xl:min-h-0` and the ROWS container is
`xl:flex-1 xl:min-h-0 xl:overflow-y-auto`. The untagged bar, the column labels and
the closing line stay outside that scroller, so a column of figures never loses its
heading — the same reasoning as `.table-scroll`'s sticky `thead`, done with layout
instead of `position: sticky`. Measured at the 900px window: rows area 404px of 941
total, panel 606.

Two consequences had to be handled, both of them created by the scroll container:

- **The dropdown was clipped.** `TagSelect`'s option list is a child of its row, and
a scroll container clips what hangs out of it, so the last rows' popups were cut
off. It now measures the room below at open time — against the nearest
`[data-tag-scroll]` ancestor, or the window when there is none — and opens upward
when that is where the space is. Verified live: the last row opened a full ten-option
list (148px) upward and stayed entirely inside the scroller; the first row still
opens downward.
- **The edited row wants to be visible.** Opening an editor scrolls its row to the
centre of the panel (`block: "center"`, instant under `prefers-reduced-motion`),
so a popup opening below it has the room it needs — guarded on the container
actually scrolling, since below `xl` there is no such container and jumping the
page would be noise. The last row cannot be centred (the scroller is already at its
end), which the upward-opening popup covers.

### The chart column

The two chart cards keep their natural heights and the COLUMN scrolls as one unit
(`xl:min-h-0 xl:flex-col xl:overflow-y-auto`) rather than each card being given
half a fixed height. That was the first attempt and it was wrong for a visible
reason: with rows of `1fr 1fr`, the currency card had 287px for 318px of content,
so its last sentence was cut off at the card's own border — a broken-looking panel,
worse than a scrollbar. As a column the cards come to 596px against 606 available
at a 900px window, so nothing scrolls at all there, and the only case that scrolls
is a window shorter than about 810px.

The ring also went back to **176px** (192 since Part 36), which is worth 32px across
the two cards and is the number DESIGN's sizing note already described: the hole is
116px across and the centre readout's longest line measures 99px.

### Verification

- `npx tsc --noEmit` clean, `npx eslint app components lib tests scripts` clean,
  `npm test` **24 files / 404 tests**, `npx next build` clean.
- **Live, one screen.** At 1420×900 (viewport 821): grid 606px tall at y=183,
  `scrollHeight == innerHeight == 821`. Chart cards 262 and 318, column content 596,
  no scrollbar anywhere in the left column. Tag panel 606 with a 404px rows area and
  941px of rows.
- **Live, the dropdown.** With the rows scrolled to the end, the last row's editor
  opened a 148px list upward, `listTop 522 / listBottom 670` inside a scroller of
  `319 → 723` — fully inside. The first row's editor still opened downward.
- **Live, below `xl`.** At a 1077px viewport the page is what it was: chart panels
  side by side at y=183, grid 1486px tall, the page scrolling (1701px) and the rows
  container NOT bounded (951 = 951).

### Known gaps

- **Under about 810px of viewport height the chart column scrolls** as one unit.
  That is the fallback for a short window; the page still does not scroll.
- **The chrome constant is a number, not a measurement.** `13.5rem` is right for
  this page under the Positions tabs; moving the page under different chrome would
  want it re-measured, which the comment beside it says.
- **The two chart cards no longer have equal heights** (262 against 318), because
  the column gives them their natural size. Equal heights was the first attempt and
  lost to the caption clipping described above.
