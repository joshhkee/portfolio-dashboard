# Investments

A private portfolio dashboard for a small group who pay into one portfolio on a
monthly schedule. It replaced a Google Sheet, and it kept the sheet's central
idea: **only two tables are real, and everything else is arithmetic on top of
them.**

`Transaction` (buys and sells) and `Contribution` (deposits) are the ledger.
Open positions, completed trades, portfolio totals, each stakeholder's share,
returns, risk and exposure are all derived by replaying that ledger on every
request (`lib/portfolio-engine.ts`) — never stored, so they cannot drift out of
sync with it. `CashBalance` is the one deliberate exception: a real balance that
the ledger writes to, that can be corrected by hand, and that is never
recomputed on read.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL ·
Recharts · Vitest. Live prices come from Yahoo Finance's public chart endpoint
(no API key) — everything funnels through `lib/prices.ts`, so swapping in a paid
provider is a change to one function.

## What's in it

Five objects, each carrying the reports that describe it as a **lens inside the
object** rather than as a peer in the nav.

### Today — `/`

One screen, measured at 0px of scroll at 1440×900: portfolio value with the day's
move, the change since your last visit, a value chart with drawdown and range
selectors, the largest positions, today's movers, and an attention list that
carries only what is actionable (a closed month with no deposit recorded, a
position with no live quote).

### Positions — `/positions`

Every open holding, one table per market — `/positions/holdings` — side by side,
with arrows that slide across them when all three do not fit. Each table has its
own heading (the market, its holding count, its total in that market's own
currency), its own sort, and live quotes. A cell pairs a figure with the one it is
measured against: the value over the number of shares, the current price over the
average cost paid, P/L over its percentage, this holding's share of the whole
portfolio over how long it has been held. Every pair is sortable from its own
header — click again and the header changes its name to say which of the two
figures is doing the ordering (`Value` → `Shares`), and the header shows which of
its states you are at as a row of dots. The instrument's resolved name sits under
its ticker, and each market's heading carries its flag. Rows and headings stay in
each market's native currency; the two figures above the tables are SGD. Where
there is room for two tables but not three, HK sits under SG rather than a click
away; the strip of one-at-a-time panels is the last resort below 1220px. The old
per-region URLs (`/positions/us`, `/positions/sg`, `/positions/hk`) forward here.

- **Exposure** lens (`/positions/exposure`) — a ten-tag sector vocabulary and the
  local-versus-currency P/L split, as three donuts down the left of the page with
  the tag list beside them. On a desktop it is one screen with no page scroll: the
  tag list is a fixed height and scrolls inside its own panel, under its column
  labels. Pointing at a sector enlarges it and dims the rest, ring and legend
  together, and the ring's centre swaps the total for that sector's name, value and
  share — there is no boxed tooltip over the chart.
- **The ledger** lens (`/positions/transactions`) — every buy and sell with the
  line the row derives for itself, plus edit and delete.

### Performance — `/performance`

XIRR beside TWR (money-weighted versus contribution-stripped), a benchmark
comparison against `^GSPC` / `URTH` / `^STI` with alpha and beta, volatility and
Sharpe, drawdown, concentration, and a rolling one-year return.

- **Attribution** lens (`/performance/attribution`) — contribution to return by
  position and by period.
- **Realized trades** lens (`/performance/realized`) — every sell, with realized
  P/L at the moment of the sale.

### Money — `/money`

Deposits, the deposit schedule, the per-stakeholder split and the outlay history.

- **Cash & conversions** lens (`/money/cash`) — stored balances and the currency
  exchange log.

### Watchlist — `/watchlist`

Names and today's move from the same quote pipeline as everything else, a 30-day
trend, and entry signals computed from a year of daily closes: 1-year range
position, % off the high, Wilder RSI(14), and price against the 50/200-day
averages — with an entry-level chart one click down.

**Accounts** (`/accounts`) is chrome rather than an object: it hangs off the
account chip in the nav. Old URLs are not broken — the app was once organised by
report name, and `next.config.js` redirects every old path (`/holdings/*`,
`/exposure`, `/attribution`, `/outlay`, `/cash`, `/completed-trades`,
`/positions/trades`) to the object that owns it.

## Signing in

There is no public sign-up and no per-role data: every account sees the same
dashboard.

- **`SITE_PASSWORD`** is a shared gate. Set it and the whole app sits behind it;
  leave it empty and middleware treats that as "no protection configured" and
  lets everyone through.
- **Accounts** add an identity on top of the gate. A username and password
  (scrypt-hashed, never stored or logged in plaintext) sign you in, and the only
  thing they change is what the app can remember *per person* — the first
  consumer is Today's "since you last looked" line.
- **Approval is not access control.** Because the shared password already opens
  the dashboard, a pending request can look around while it waits; what approval
  decides is whose name the visits are recorded against. The login page offers
  three named ways in — sign in, request an account, or use the shared password —
  and saying so is deliberate rather than implying a waiting person is shut out.
- **Roles.** An admin approves requests, creates accounts, resets and removes
  them; a member can change their own password and ask for an account for
  someone else.
- **The first account** can be created from `/accounts` itself when none exists
  (a bootstrap rule, so the page is reachable without a shell), or from the CLI:
  `npm run user:add`. Once any account exists the bootstrap is closed and only an
  admin can add more.

## Setting up

### 1. A database

Any Postgres will do. The setup these notes were written against is a free
[Supabase](https://supabase.com) project: **Project Settings → Database →
Connection string → URI**, then swap in your password.

### 2. Environment

```bash
cp .env.example .env
```

| variable | required | what it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Quote the whole value, including any query string. |
| `SITE_PASSWORD` | no | The shared gate. Empty means the app is open. |
| `AUTH_SECRET` | no | Signs account session cookies. Falls back to `SITE_PASSWORD`, so changing the shared password signs every account out unless this is set. Add it by hand — the template predates it. |
| `PRISMA_CONNECTION_LIMIT` | no | Connections per client, default `1`. Supabase's pooler caps a session at 15 clients, and a running dev server can exhaust that (`EMAXCONNSESSION`); see `lib/prisma.ts`. |

Never commit `.env`, and never print its values.

### 3. Tables and data

```bash
npx prisma migrate deploy    # applies the migrations
npm run seed                 # optional: loads the transcribed sheet history
npm run dev                  # http://localhost:3000
```

Use **`migrate deploy`**, not `migrate dev`, against a shared or pooled database:
`dev` wants a shadow database and will try to reset on drift. `migrate dev` also
refuses to run in a non-interactive shell — generate SQL with
`npx prisma migrate diff` and hand-write the migration instead (the exact command
is in `AGENTS.md`).

`npm run seed` loads the contributions and transactions transcribed from the
original sheet, so the dashboard opens with real data instead of empty tables. It
only runs against an empty database and will not duplicate rows.

`npm run backfill` writes the `DailySnapshot` rows for the days before the app
existed, reconstructed from the ledger plus historical closes. Snapshots are what
the performance, risk and attribution pages read, and a snapshot is only ever
written for a day that has none.

## Scripts

| command | what it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate` then `next build` |
| `npm start` | serve the production build |
| `npm test` / `npm run test:watch` | Vitest (pure logic — no database, no network) |
| `npm run lint` | ESLint, flat config |
| `npm run seed` | load the transcribed sheet history into an empty database |
| `npm run backfill` | write the historical `DailySnapshot` rows |
| `npm run user:add` | create an account from the shell, password typed not echoed |
| `npm run notes:cleanup` | the one-time stored-notes cleanup — dry run unless given `--apply`, and `--revert FILE` puts every note back |
| `npm run prisma:generate` / `npm run prisma:migrate` | Prisma client / `migrate dev` |

## Checks

```bash
npm test
npx tsc --noEmit
npx eslint app components lib tests scripts
npm run build
```

All four should be clean before a change is considered done. Add a test under
`tests/` whenever the change touches pure logic — see `AGENTS.md` for the
conventions and the architecture rules these commands are protecting.

## Deploying

1. Push the repository to GitHub.
2. Import it into Vercel and set the environment variables (`DATABASE_URL`,
   `SITE_PASSWORD`, and `AUTH_SECRET` if you use it).
3. Run `npx prisma migrate deploy` once against the production database — that
   database is usually the same one a local checkout points at, so this is often
   a no-op.

## Documentation

| document | what it is for |
|---|---|
| `AGENTS.md` | The working agreement: architecture invariants, non-goals, verification, code layout, and the conventions a contributor or agent is expected to follow. |
| `docs/DESIGN.md` | The design system: colour tokens and their measured contrast, typography, table rules, chart conventions, motion, and the copy/voice rules. |
| `docs/PLAN.md` | The build history: a status table of every part of the work, per-part write-ups with the measurements behind them, and the open backlog. |
| `.freebuff/run.md` | Machine-local operations for this checkout (dev-server port, Prisma engine lock, and how to inspect the open pull request). Untracked, not part of the project. |

## Deliberately not built

Fees and commissions are considered negligible, and there is no target
allocation or rebalancing-drift view. Both were rejected by the owner rather than
forgotten — see `AGENTS.md`.
