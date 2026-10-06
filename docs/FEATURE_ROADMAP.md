# Feature Roadmap & Cohesion Architecture

> **Purpose:** Defines the feature evolution of the portfolio dashboard, ensuring institutional-grade analytics are introduced with strict progressive disclosure, zero UI clutter, and complete preservation of dedicated bookkeeping tools.

---

## 1. Architectural Principles: Purposeful Analytics & Anti-Bloat

A core hazard of expanding a portfolio dashboard is turning a calm, high-signal private banking terminal into an overwhelming Bloomberg-style wall of numbers. To prevent information dumping:

### 1.1 The 3-Tier Progressive Disclosure Model
Every screen strictly adheres to three tiers of data density:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: The Glance (Default Surface — Scan in 3 seconds)               │
│ - 1 headline number + 1 direction/status.                              │
│ - Example: Ticker, Price, Value, and Target Proximity (e.g. "-2.4%").  │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: The Paired Glance (At-a-glance Context)                        │
│ - Secondary context paired underneath primary numbers in ink-500.       │
│ - Example: Value over Shares, Price over Avg Cost, P/L over Return %.  │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: The Deep Dive (On-Demand Bottom Sheet / Modal)                 │
│ - Full analytics revealed ONLY when tapping a row or card.            │
│ - Contains: 52w range, P/E multiples, RSI(14), moving averages,       │
│   full trade cycle history, and position sizing calculator.           │
│ - Zero UI furniture: No clunky "Show More" accordion buttons.          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Dedicated Bookkeeping Invariant (Transactions & Cash Exchanges)
- **Bookkeeping is permanent:** Detailed audit logs are essential for accounting, tax verification, and reconciliation.
- **Transactions Ledger:** Full column detail (date, action, ticker, region, qty, price, running qty, running avg cost, notes, CSV export) remains permanently accessible.
- **Cash & Currency Exchange Log:** Detailed FX logs (rates, before/after balances, manual vs auto rate, CSV export) remain fully accessible.
- **Consolidation Rule:** The Unified Activity Feed aggregates events chronologically for high-level monitoring, but **never replaces or degrades** the dedicated bookkeeper ledgers.

---

## 2. Feature Roadmap Parts

```
┌────────────────────────────────────────────────────────────────────────┐
│                       SEQUENCE OF WORK                                 │
│                                                                        │
│  FOUNDATION: Design & Mobile Overhaul (Phases 1–3)                     │
│     └── Establish PWA shell, bottom nav, mobile cards, bottom sheets   │
│                                                                        │
│  PART 39: Watchlist Redesign & Target Entry Gauges                     │
│     └── 3-tier progressive disclosure, price targets, sizing preview   │
│                                                                        │
│  PART 40: Unified Activity Timeline (with dedicated bookkeeping views) │
│     └── Chronological feed aggregating trades, deposits & FX exchanges │
│                                                                        │
│  PART 41: Dividends & Forward Income Tracking                          │
│     └── Distribution logs, yield-on-cost, total vs price return        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 39 — Watchlist Redesign & Target Entry Gauges

### Problem Statement
The current watchlist (`/watchlist`) dumps technical signals (RSI-14, 50/200d averages, 1y range bar) inside a wide table or expanded row with an unguided "Why" text box. It lacks actionable buy targets and valuation context.

### The 3-Tier Execution
- **Tier 1 (Surface):** Ticker + Flag + Name, Current Price, Session Change (%), Target Proximity Pill.
  - *Proximity formula:* $\Delta\% = \frac{\text{Current Price} - \text{Target Price}}{\text{Target Price}}$
  - $\Delta\% \le 0$: Highlight with `badge-accent` (*"At/Below Target"*).
  - $0 < \Delta\% \le 0.05$: Subtle gold pill (*"+3.2% above target"*).
  - $> 0.05$: Muted ink hint.
- **Tier 2 (Paired):** Target Buy Price paired under Current Price; Valuation Multiple (e.g. `P/E 24.2`) paired under Company Name.
- **Tier 3 (Deep Dive Drawer / Sheet):**
  - Tapping row opens a slide-up sheet:
    - 1-Year range gauge and 50/200-day trend chart.
    - Wilder RSI(14) with plain-English indicator (e.g. *"Oversold (28)"*).
    - **Position Sizing Calculator:** Input desired shares $\rightarrow$ previews native cash required, SGD outlay, and resulting portfolio % based on today's total portfolio value.

### Schema Expansion (`prisma/schema.prisma`)
```prisma
model WatchlistItem {
  id             Int       @id @default(autoincrement())
  ticker         String
  region         String    // "US" | "SG" | "HK"
  notes          String?   // Thesis / rationale
  targetBuyPrice Float?    // Actionable entry target
  targetAllocPct Float?    // Target portfolio weight (e.g. 0.05 for 5%)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([region, ticker])
}
```

---

## Part 40 — Unified Activity Timeline & Bookkeeping Preservation

### Problem Statement
Portfolio activity is currently fractured across three disconnected locations:
- Trades: `/positions/transactions`
- Deposits: `/money`
- Currency Conversions: `/money/cash`

### Architecture & Cohesion
1. **Unified Activity Timeline (`/activity` or `/money/activity`):**
   - High-level chronological stream aggregating Buys, Sells, Deposits, and FX Exchanges.
   - Filter chips: `[All] [Trades] [Deposits] [Exchanges]`.
   - Allows quick audit of what happened last week or last month across all assets.
2. **Preserving Dedicated Bookkeeping Views:**
   - **Full Transactions Ledger:** Retains its dedicated URL (`/positions/transactions`) with editable rows, backdated quantity checks (`findNegativeQtyAfter`), and CSV export.
   - **Dedicated Cash & FX Log:** Retains its dedicated sub-panel (`/money/cash`) showing exact currency balances, conversion rates, and hand-adjustment capabilities.
   - The Unified Timeline acts as the executive window; the dedicated tables act as the immutable accounting journals.

---

## Part 41 — Dividends & Total Return Modeling

### Problem Statement
Cash distributions (especially for SG bank holdings and US dividend payers) currently have no paper trail, forcing manual adjustments to `CashBalance` and understating true total returns.

### Architecture & Cohesion
1. **Dedicated `Dividend` Ledger:**
   ```prisma
   model Dividend {
     id          Int      @id @default(autoincrement())
     date        DateTime
     region      String   // "US" | "SG" | "HK"
     ticker      String
     amount      Float    // Net cash received after withholding, in native currency
     currency    String   // "USD" | "SGD" | "HKD"
     amountSgd   Float    // Converted to SGD at date's FX rate
     withholding Float    @default(0) // Foreign withholding tax
     notes       String?
     createdAt   DateTime @default(now())

     @@index([ticker, region])
     @@index([date])
   }
   ```
2. **Progressive Disclosure:**
   - **Tier 1:** Trailing-12-month net dividend yield appears quietly in the `/performance` stats strip, divided by current holdings value.
   - **Tier 2:** In `/positions/holdings`, trailing-12-month net yield on cost appears under unrealized return when a payment is recorded for that holding.
   - **Tier 3:** A dedicated dividend payment ledger and actual monthly receipt history are available under `/money`. Do not infer future payment dates or schedules until there is evidence to support them.
3. **Cash Balance Auto-Sync:**
   - Logging a dividend atomically increments the respective `CashBalance` by the net amount actually credited. Withholding is stored separately as reference and is not credited to cash.
   - `amountSgd` records the net payment converted using the payment-date historical FX close; a missing historical rate rejects the entry rather than silently using today's rate.
4. **Return boundary:**
   - Dividend receipts are a separate income ledger. They do not modify transaction-derived positions, cost basis, or capital gains; recorded cash and snapshots remain their existing sources for portfolio value and total-return history.
