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

## Status

| Part | Scope | Status |
|---|---|---|
| 1 | Gold chart series + outlay-line separation | **DONE** |
| 2 | Stock name lookup from chart meta, cached + override | **DONE** |
| 3 | Contrast corrections + gold-as-data fix | **DONE** |
| 3b | Multi-series data palette | DEFERRED (belongs with Part 5) |
| 4 | TWR, underwater chart, range selectors | TODO |
| 5 | Benchmark comparison + alpha/beta | TODO |
| 6 | Per-stakeholder performance view | TODO |
| 7 | Sparklines + command palette | TODO |

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
- Added a `data` colour token (`#7d97b3`, 5.76:1 on panels) and moved the two
  proportion bars off `bg-accent/70` (`app/page.tsx` region bars,
  `AllocationCards.tsx` stakeholder bars). Gold now only ever means
  "interactive": the remaining `bg-accent` uses are the contribution-form tab
  and the cash exchange-mode toggles, both genuine controls.

Deliberately NOT done: the six-colour multi-series palette. With one chart
series in the app there is nothing to colour, so those tokens would sit unused
until Part 5 introduces a second series. Add them there.

**Acceptance met:** the two failing pairs now pass AA in every context they
appear; data fills no longer use the chrome accent.

---

## Part 4 — TWR, underwater chart, range selectors

- Time-weighted return alongside XIRR, chained from `DailySnapshot`
  (`totalValueSgd` + `costBasisSgd`), neutralizing contribution timing. XIRR is
  money-weighted and rewards *when* money landed; TWR isolates the strategy.
- Underwater (drawdown-over-time) curve; its minimum must equal
  `maxDrawdown()`'s value.
- Range selectors (1M / 3M / YTD / 1Y / 3Y / All) driving both charts, plus a
  calendar-year return table.

**Acceptance:** TWR differs from XIRR when contributions are uneven and matches
it for a single lump sum (prove with a unit test).

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
