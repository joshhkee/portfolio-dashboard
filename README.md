# Investments — portfolio dashboard

A personal replacement for your Google Sheets investment tracker: Portfolio
(contributions), Transactions, Open Positions (US), Open Positions (SG/HK),
and Completed Trades.

## How it's built

Two tables hold real data — `Transaction` and `Contribution`. Everything
else (open positions, completed trades, per-stakeholder portfolio %) is
**computed** from those on every page load, the same way your sheet's
formulas worked. See `lib/portfolio-engine.ts` for the weighted-average
cost-basis logic (buys blend into the running average; a sell realizes
P/L against that average; once a position's quantity hits zero, the next
buy naturally starts a fresh average — no separate "reset" step needed).

Stack: Next.js (App Router) + TypeScript + Tailwind, Prisma ORM,
PostgreSQL. Live prices come from Yahoo Finance's public chart endpoint
(no API key) — see `lib/prices.ts` if you'd rather swap in a paid
provider later.

## 1. Set up a database

The easiest option is a free [Supabase](https://supabase.com) Postgres
project:

1. Create a project at supabase.com.
2. Go to **Project Settings → Database → Connection string → URI**, copy
   it, and swap in your password.

## 2. Local setup

```bash
npm install
cp .env.example .env
# paste your DATABASE_URL into .env

npx prisma migrate dev --name init   # creates the tables
npm run seed                          # loads your existing sheet history
npm run dev                           # open http://localhost:3000
```

The seed script (`prisma/seed.ts`) loads the contributions and
transactions transcribed from your current sheet, so the dashboard opens
with real data instead of empty tables. It only runs against an empty
database — it won't duplicate rows if you run it twice.

## 3. Using it

- **Portfolio** — shows each stakeholder's total contribution and % of
  the fund, plus the full deposit history. "Record a deposit" adds a new
  one.
- **Transactions** — the full buy/sell ledger with running qty and
  running average cost, computed live. "Log a transaction" adds one;
  each row has a Delete link for corrections.
- **Open Positions (US)** and **(SG/HK)** — derived from your open
  transactions, with a live quote pulled in for current price and
  unrealized P/L. SG tickers are queried as `TICKER.SI`, HK tickers as
  `TICKER.HK`.
- **Completed Trades** — every Sell, with realized P/L and return %
  computed at the moment of that sale.

There's no login — this is built for single-user access (you). If you
ever need to restrict who can view it, the simplest option is Vercel's
built-in password protection or IP allowlisting on the deployment.

## 4. Deploying

1. Push this folder to a GitHub repo.
2. Import it into [Vercel](https://vercel.com) (New Project → your repo).
3. Add the `DATABASE_URL` environment variable in Vercel's project
   settings (same value as your local `.env`).
4. Deploy. Run `npx prisma migrate deploy` once against the production
   database (or run migrations locally pointed at the same Supabase
   instance before your first deploy — either works).

## Extending it

- **Correcting a contribution**: there's no edit/delete UI for
  contributions yet (only transactions). Easiest fix for now: use
  Prisma Studio (`npx prisma studio`) to edit rows directly, or ask me
  to add the UI for it.
- **More stakeholders**: just type a new name into "Record a deposit" —
  contributors are created automatically the first time they're used.
- **A different price source**: everything funnels through
  `fetchQuote()` in `lib/prices.ts` — replace its body to call a
  different API and nothing else needs to change.
