# AGENTS.md

The working agreement for anyone — a person or a coding agent — changing this
repository. It holds the rules that must survive any single change. The build
history and the backlog live in `docs/PLAN.md`; the visual and copy rules live in
`docs/DESIGN.md`.

## What this is

A private portfolio dashboard. `Transaction` (buys and sells) and `Contribution`
(deposits) are the ledger; everything the app shows is derived by replaying them.
The README describes the product; this file describes how to change it without
breaking it.

## Read before you start

1. This file — the invariants and the verification protocol below.
2. `docs/DESIGN.md` if the change is visible, or touches copy.
3. `docs/PLAN.md` if you need to know why something is the way it is, or what is
   already planned. Its status table is the backlog.

## Architecture invariants

Breaking one of these is a bug even if the tests pass.

1. **`Transaction` and `Contribution` are the only source of truth.** Open
   positions, completed trades, portfolio totals and percentages are DERIVED by
   replaying the ledger (`lib/portfolio-engine.ts`). Never store a value that can
   be derived, because a stored copy drifts.
2. **`CashBalance` is the one deliberate exception.** It is real, stored,
   hand-editable, auto-adjusted by contributions, buys, sells and exchanges
   (`lib/cash.ts`), and never recomputed from the ledger on read.
3. **`DailySnapshot` rows are frozen historical facts.** `recordTodaySnapshot()`
   is idempotent per UTC day, only ever rewrites today, and must fail soft:
   snapshot recording can never break a page load.
4. **Prices and metadata are keyed by the compound `region::ticker`**
   (`priceKey()` in `lib/prices.ts`). A bare ticker is not unique across regions,
   so a ticker-only map silently collapses two holdings into one.
5. **Quantity checks scan every ledger row, not the final quantity.**
   `findNegativeQtyAfter` / `findFirstNegativeQty` exist because a backdated sell
   can dip a position negative mid-replay and recover later.
6. **A displayed fact is derived, and stored text is appended.** The ledger's
   note line is computed from the row (`lib/notes.ts`) and a note someone typed
   is shown *after* it, never instead of it.
7. **Colour means up or down, and never means anything else.** A plain value is
   neutral however large it is. See `docs/DESIGN.md`.

## Non-goals — rejected on purpose

Do not add these; they have been considered and declined.

- Fees and commissions tracking.
- Target allocation percentages and rebalancing drift.
- A second price source, or a second place that computes a portfolio total.

## Verification

Run all four before calling a change done:

```bash
npm test
npx tsc --noEmit
npx eslint app components lib tests scripts
npm run build
```

- Tests are pure: `tests/**/*.test.ts` runs in a Node environment with **no
  database and no network**. Put logic that needs pinning in a `lib/*` module so
  it can be tested that way (`lib/performance.ts`, `lib/benchmarks.ts`,
  `lib/stakeholders.ts` are the models to copy).
- Any change to pure logic gets a test. The count moves with the feature; tests
  are deleted with the code they covered rather than left stale.
- Call `npx eslint` directly: `next lint` is broken in this version of Next.
  ESLint 9 is configured by the flat `eslint.config.mjs`, so there is no
  `.eslintrc` to edit.
- `.next` holds generated route types that `tsc` reads, so a phantom error about
  a route you deleted usually means `.next` is stale — rebuild before chasing it.
- `middleware.ts` is deprecated in Next 16 in favour of the `proxy` convention.
  It warns on every build; migrating it is optional cleanup, not a bug.
- If verification writes to the database, undo the write and say so. The database
  is shared with the deployed app.
- Report what you measured, not what you intended. A number — a viewport width, a
  contrast ratio, a scroll height, a query result — or an explicit "not verified"
  is the standard this repository already holds itself to.

## Where code goes

| path | what belongs there |
|---|---|
| `app/` | Routes and route handlers. Server components by default; `export const dynamic = "force-dynamic"` on anything that must not be cached. |
| `components/` | UI. `"use client"` only where interactivity needs it. |
| `lib/` | Logic. Pure helpers (no DB, no network) live here so they can be unit-tested; modules that read the database are data modules (`lib/get-positions.ts`, `lib/snapshots.ts`). |
| `prisma/` | Schema, migrations, seed, snapshot backfill. |
| `scripts/` | One-off operational scripts. Linted like app code, not exempt from it. |
| `tests/` | Mirrors the `lib/` module it covers. |

`lib/*` must never import from `components/*`. That is why formatting helpers
live in `lib/format.ts` and `components/SignedNumber.tsx` re-exports them:
server-side modules need the same formatting, and the dependency arrow only
points one way.

## Conventions

- **Comments explain why.** The house style is a short paragraph on the decision,
  the alternative that was rejected, and the measurement that settled it. When
  you remove something deliberate, say why it went — that note is what stops the
  next reader from helpfully putting it back.
- **Never override a `globals.css` class with a Tailwind utility.** Classes in
  the `utilities` layer that carry a class *and* an element in the selector
  (`.ledger-table td`) outrank a plain utility regardless of source order. This
  has caused the same bug three times (`.field`'s `w-full`, `.panel`'s border,
  `.ledger-table td`'s `whitespace-nowrap`); the fix is a real selector in that
  layer, like `.cell-wrap` and `.cell-pin`.
- **Do not add a dependency for something already hand-rolled.** The sparkline is
  an inline SVG rather than ~18 chart instances, and the palette index is a pure
  function over a flat list.
- **Prefer a disclosure to a hover tooltip**, and give every pointer-only path a
  keyboard equivalent. Touch has no hover, and a tooltip cannot be re-read.
- **Accessibility baseline:** text contrast measured against its worst-case
  background, colour never the only carrier of meaning (signs, arrows and labels
  accompany it), `prefers-reduced-motion` honoured.
- Match the existing vocabulary in the UI: a "value" is neutral, a "gain" is
  coloured, an "outlay" is what was paid in, and a lens is a view of an object.

## Data and secrets

- The Postgres database is **shared with the deployed app**. A migration, an
  account or a note edited from a worktree is already live.
- Never print, commit or stage environment values. `.env` is ignored; keep it
  that way.
- Never run a destructive database command (`migrate reset`, `drop`, truncate)
  against this project: the ledger is real and is not reproducible.
- Migrations must be additive and nullable when the deployed revision does not
  know the new column yet, or the running app will break until it is redeployed.
- `prisma migrate dev` refuses in a non-interactive shell and wants a shadow
  database a pooled connection cannot create. Generate the SQL and hand-write the
  migration:

  ```bash
  npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma --script
  npx prisma migrate deploy
  ```

## Working with the owner

- Ask before a decision that changes what the product *means* — what a word on
  screen denotes, what a page shows, whether access is a gate or a label. For
  reversible implementation detail, decide, and say what you decided.
- Do not commit, push, open a pull request or merge one unless asked to. The
  branch and pull-request workflow for this project is in `docs/PLAN.md`.
- When a batch of work lands, update `docs/PLAN.md`'s status table and its resume
  checkpoint. Durable rules belong in this file or `docs/DESIGN.md`, not only in
  the plan: the plan records what happened, these two say what still holds.

## This machine

Machine-specific procedures — the dev server's port, the Windows Prisma engine
lock, environment-file quoting, and how to inspect the open pull request — live
in the local, untracked `.freebuff/run.md`. Keep them there: committed docs carry
rules that are true anywhere, not the quirks of one checkout.
