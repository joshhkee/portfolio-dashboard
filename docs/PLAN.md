# Build plan — portfolio dashboard improvements

Segmented so each part is independently verifiable and hand-offable. Work the
parts in order; a part is DONE only when its checkpoint passes.

## How to hand this off

Paste this into any coding agent: *"Read `docs/PLAN.md` in this repo. Follow its
invariants and non-goals, then implement the first part whose status is not
DONE. Run that part's checkpoint before moving on."*

Each part below is sized to finish in one sitting. Nothing later depends on
anything not listed as a prerequisite, so stopping between parts is always safe.

## Checkpoint protocol (identical for every part)

```bash
npm test                       # Vitest
npx tsc --noEmit               # typecheck
npx eslint app components lib tests
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

## Pull-request workflow — required from 2026-09-22

One long-lived pull request is kept open for this branch against `main`, and
every checkpoint keeps it green:

- Branch: `freebuff/analyse-my-current-portfolio-dashboard-project-and-29b0adb2-a864-46b1-9352-6fb3fcb2b204`
  (`origin` -> `github.com/joshhkee/portfolio-dashboard`).
- A batch of work rides ONE long-lived pull request (same branch -> `main`).
  #3–#8 are all merged. **The open PR is #9**
  (https://github.com/joshhkee/portfolio-dashboard/pull/9), carrying parts 12–14a
  plus the Prisma build fix. Nothing should open a second PR while one is
  already open for this branch — but DO open a new one when the previous batch
  was merged, because a merged PR cannot be reopened to carry later work.
- Push normally. **Never** force-push, switch branches, or change git config.
- A clean `git push` is NOT proof the PR is conflict-free — re-read the PR and
  check `mergeable` / `mergeable_state` explicitly.
- If a conflict appears, bring the base in (`git merge origin/main`), resolve
  every conflict preserving both sides' intent, re-run the checkpoint protocol,
  then push again. Rebase only if the owner explicitly asks.
- `main` moves under this branch each time the owner merges a PR, so re-check
  mergeability before declaring a checkpoint done.

This machine has no `gh`. The token `git push` already uses is stored in the
Windows Credential Manager; `printf "protocol=https\nhost=github.com\n\n" |
git credential fill` prints it. Use it only in-process — never echo it, never
commit it, and delete any temporary file immediately. Then read the PR through
`GET /repos/joshhkee/portfolio-dashboard/pulls/<n>` and look at `mergeable`,
`mergeable_state`, `state` and `merged_at`.

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
| 8 | Notes redesign (auto factual half + structured context) | TODO — owner picks an option first |
| 9 | Concentration & risk analytics (HHI, Sharpe, correlation, rolling 1Y) | **DONE** |
| 10 | Exposure analytics (sector tags, currency + FX attribution) | **DONE** |
| 11 | Contribution attribution (per position, per period) | **DONE** |
| 12 | Responsive & loading polish (mobile tables, skeletons) | **DONE** |
| 13 | Range-selector transitions + load-time optimisation | **DONE** |
| 14a | Deposit schedule: `Contribution.paidOn` + a quiet late flag | **DONE** |
| 14b | Currency reporting: price-only P&L, realized FX, foreign cash | **REMOVAL DONE** (purchase-date FX split deleted); the two replacement panels are still TODO — see the Part 14b section |
| 15 | IA: five objects, lenses nested, old URLs redirected | **DONE** |
| 16 | Accounts: username + password, per-account `lastSeenAt` | **DONE** — no account created yet; run `npm run user:add` (the shared-password gate still works) |
| 17 | Today: hero + since-last-visit, needs-attention, schedule line, one chart, largest positions | **DONE** |
| 18 | Activity: the four ledgers merged into one filterable timeline | TODO — proposed, not built |

---

## Resume checkpoint — 2026-09-22 (after Part 17)

**State:** parts 1–7 and 9–17 finished and verified. This round: the **14b
removal** (the `/exposure` purchase-date FX split and its machinery are gone),
consistent `S$` labelling, the **five-object IA** with the old URLs redirected,
**accounts** (`npm run user:add`; the shared gate still works and no account has
been created yet), and the **dashboard rebuilt as Today** — 12 panels to 4,
4 charts to 1, 448 rendered figures to 31.

**Next action:** whichever the owner picks —
**Part 18 the `/activity` ledger**, **14b's two remaining panels** (realized FX
on the 25 conversions; unrealized FX on the foreign cash), the **monolith split**
(`app/page.tsx` and `lib/portfolio-engine.ts` are both large enough that a
maintainer would flag them), or **Part 8** (notes redesign, still blocked on an
owner decision).

**Environment notes that are easy to lose:**
- The database is SHARED with the main checkout, so a migration or an account
  created here is already live for the deployed app.
- `AUTH_SECRET` is optional. With it unset the signing secret falls back to
  `SITE_PASSWORD` (so changing the shared password signs every account out);
  set it before rotating the shared password if that matters.
- `npm run user:add` can run with the dev server up — it uses its own Prisma
  client. Only `npm run build` collides with a running server (the Windows
  Prisma engine DLL lock documented in the run doc).
- `npx tsc --noEmit` reads generated route types from `.next`, so it reports
  phantom errors about deleted routes until `.next` is rebuilt after a move.
(This heading has tracked each batch — "after Part 11", "after Part 14a", "after
Part 14b" — and the body below is kept because its data-quality findings are
still current.)

**Part 10 needs no further action on the database:** migration
`20260922140000_add_ticker_sector` is applied and the column exists. No sector
tags are stored yet (the DB is exactly as it was found), so the sector donut
correctly reads Unclassified 100% until the owner tags instruments on
`/exposure`.

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
npm test                                     -> 15 files, 229 tests passed
npx tsc --noEmit                             -> clean
npx eslint app components lib tests scripts  -> clean
npm run build                                -> succeeded (see the build note below)
```

(The count went 230 -> 216 when the 14 FX-split tests left with their code, then
216 -> 229 with Part 16's 13 auth tests. Note `scripts/` is now in the eslint
target — the create-user script is app code and should be linted like the rest.)

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

## Architecture invariants — do not break these

1. `Transaction` and `Contribution` are the only source of truth. Open
   positions, completed trades, portfolio %, and totals are DERIVED by replaying
   the ledger in `lib/portfolio-engine.ts`. Never store derived values that can
   drift from the ledger.
2. `CashBalance` is the single deliberate exception: stored, hand-editable,
   auto-adjusted by contributions/buys/sells/exchanges (`lib/cash.ts`), never
   recomputed from the ledger on read.
3. `DailySnapshot` rows are frozen historical facts. `recordTodaySnapshot()` is
   idempotent per UTC day, only rewrites today, and must fail soft — snapshot
   recording must never break a page load.
4. Quote/meta maps are keyed by compound `region::ticker` (`priceKey()` in
   `lib/prices.ts`). A bare ticker is NOT unique across regions.
5. `findNegativeQtyAfter` / `findFirstNegativeQty` scan EVERY ledger row, not
   just the final quantity — a backdated Sell can dip a position negative
   mid-replay and recover later. Preserve that.
6. `prisma migrate dev` refuses in non-interactive shells. Generate SQL with
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel
   prisma/schema.prisma --script` and hand-write the migration, then
   `npx prisma migrate deploy`.

## Non-goals — explicitly rejected by the owner, do not add

- Fees / commissions tracking (owner considers them negligible)
- Target allocation % and rebalancing drift

## Environment notes

- `.env` needs `DATABASE_URL` and `SITE_PASSWORD`. Never print or commit values.
- Supabase's pooler caps session clients at 15; a running dev server can exhaust
  it and break migrations (`EMAXCONNSESSION`). Stop the dev server or add
  `?connection_limit=5` to `DATABASE_URL`.
- **If you add `?connection_limit=5`, the closing quote must come AFTER the
  query string:** `DATABASE_URL="postgresql://.../postgres?connection_limit=5"`.
  Putting it before (`"...postgres"?connection_limit=5`) makes Next's env loader
  read a value whose path is `postgres"` (%22) and every DB page 500s with
  `Database postgres%22 does not exist`. `node --env-file` parses such a file
  fine, so the failure only shows up in the Next app — verify with
  `require('@next/env').loadEnvConfig()` and `new URL(process.env.DATABASE_URL)`
  rather than trusting a Node one-liner.
- `npm run dev` may pick a random high port if 3000 is taken — read the
  "Local:" line from the startup log.
- `next lint` is broken in this version; call `npx eslint` directly.
- ESLint uses the flat `eslint.config.mjs` (ESLint 9), not `.eslintrc`.
- `middleware.ts` is deprecated in Next 16 in favour of the `proxy` convention
  (warning only; migrating is optional cleanup).

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

## Part 8 — Notes redesign

**Owner decision required before coding.** The `notes` column currently does
two unrelated jobs, and the fix is to separate them, not to restyle the field.

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
list) and stores only the hash.

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
