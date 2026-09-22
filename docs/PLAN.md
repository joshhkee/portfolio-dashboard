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
| 3b | Multi-series data palette | DEFERRED -> folded into Part 5 |
| 4 | TWR, underwater chart, range selectors, yearly table | **DONE** (merged in #5) |
| 5 | Benchmark comparison + alpha/beta (+ Part 3b palette) | TODO — **start here** |
| 6 | Per-stakeholder performance view | TODO |
| 7 | Sparklines + command palette | TODO |
| 8 | Notes redesign (auto factual half + structured context) | TODO — owner picks an option first |
| 9 | Concentration & risk analytics (HHI, Sharpe, correlation) | TODO |
| 10 | Exposure analytics (sector tags, currency + FX attribution) | TODO |
| 11 | Contribution attribution (per position, per period) | TODO |
| 12 | Responsive & loading polish (mobile tables, skeletons) | TODO |

---

## Resume checkpoint — 2026-09-22 (end of session)

**State:** parts 1–4 finished and verified. Next action: **Part 5 (benchmark
comparison + alpha/beta)**.

**Git:** parts 1–4 are committed, pushed, and **merged into `main`** through
pull requests #3, #4 and #5 (merge commits `6a357af`, `c166bf0`, `c6071c5`).
The branch head `5ccabf0` is an ancestor of `origin/main`, so the branch was
fully integrated; it has since been fast-forwarded to `origin/main` and the
backlog below was added on top. **A pull request is now opened for every
checkpoint** (see "Pull-request workflow"). Part 5 starts from `main`'s tip, so
begin by checking the PR is still mergeable before writing code.

**Verification on the current tree (all four ran green at the end of this
session):**

```
npm test                            -> 6 files, 72 tests passed
npx tsc --noEmit                    -> clean
npx eslint app components lib tests -> clean
npm run build                      -> succeeded (all routes compiled)
```

**Live preview:** previously `http://localhost:52422` (dev server from this
worktree). **The server is not running now** — the Freebuff app restarted after
this session, which kills it. Restart with `npm run dev -- -p 52422`; the port
matters, see the env notes.

**What to do first tomorrow:**

1. `npm install` if `node_modules` is missing, then confirm `.env` exists (copy
   from the main checkout) and that `DATABASE_URL` is quoted **around** the
   whole URL including any query string — see the env note below, this cost
   real debugging time.
2. `npm run dev` and confirm the home page renders (TWR, drawdown chart, and
   the calendar-year table should all show).
3. Read the Part 5 section, follow its acceptance criteria, then run the
   checkpoint protocol.

**Open items deliberately not done:** part 3b's six-colour multi-series palette
(unused until Part 5 adds a second chart series — add it as part of Part 5).
Parts 8–12 are the feature/design backlog captured from the research pass on
this date; none of them are started, and Part 8 needs an owner decision first.

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

## Part 5 — Benchmark comparison

Overlay `^GSPC`, `URTH`, `^STI` rebased to 100 via `fetchHistoricalCloses`,
with alpha and beta from regressing daily snapshot returns on benchmark
returns. Follow the backfill script's 500ms sleep between Yahoo calls.

**Acceptance:** both series rebased to 100 at range start; alpha/beta labelled
with their window; no unbounded extra Yahoo calls per page load.
Depends on Part 4's range selector.

## Part 6 — Per-stakeholder performance

The only stakeholder-level number today is "% of outlay". Add each
contributor's pro-rata share of current value, their own XIRR via the existing
`xirr()` (never a second solver), total contributed, and a contribution-vs-value
timeline. Reuse `DailySnapshot`.

**Acceptance:** all 5 stakeholders listed; shares reconcile with the home page's
total portfolio value.

## Part 7 — Sparklines + command palette

30-day mini-trends in the positions tables sourced from `fetchHistoricalCloses`
(batch the fetches — no per-row waterfall), and a Cmd/Ctrl+K palette to jump to
a ticker, log a transaction, and navigate, styled to ink-850 with a hairline
border. Honour `prefers-reduced-motion`.

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

## Part 9 — Concentration & risk analytics

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

## Part 10 — Exposure analytics

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

## Part 11 — Contribution attribution

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
