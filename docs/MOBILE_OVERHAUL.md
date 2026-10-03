# Mobile "App-Like" Overhaul Specification

> **Guiding Principle:** Desktop functionality (viewport width ≥ 1024px) remains strictly unchanged.
> Below `lg:`, the interface transitions from a wide desktop document with horizontal scrollbars into a touch-first, native Progressive Web App (PWA) experience with fixed bottom navigation, mobile list cards, bottom sheets, and thumb-friendly tap targets.

---

## Architecture & Design Invariants

Before implementing any phase, verify adherence to the project invariants:
1. **The Colour Rule (`docs/DESIGN.md` §2):** Colour means direction (green/red for gains/losses). Plain values are neutral ink (`text-ink-100` / `text-ink-300`).
2. **Tab Contrast Rule (`docs/DESIGN.md` §7):** Active tabs with a gold pill (`bg-accent`) must inherit `text-ink-950` (8.54:1 contrast). Never add a `text-*` class inside an icon in `SectionTabs` or `SlideDeck`.
3. **Derived Facts Rule (`docs/DESIGN.md` §8):** Ledger notes display derived facts first (`Opened`, `Added · avg ↑ ...`), followed by user-written notes.
4. **Desktop Preservation:** Every table on desktop (`lg:`) keeps its multi-column layouts, sort headers, and sticky headers (`.ledger-table`, `.table-scroll`, `.panel-fit`).
5. **No External Libraries:** Hand-roll all mobile patterns with Tailwind CSS and React state; do not install drawer, bottom-nav, or gesture libraries.

---

## Phase 1: Native Mobile Shell, Web Manifest & Bottom Navigation

### 1.1 Goal
Transform the website into an installable standalone PWA with safe-area handling, remove the top hamburger drawer, and introduce a persistent mobile bottom navigation bar.

### 1.2 Files to Create / Modify
- **Create:** `public/manifest.json`
- **Create:** `public/icon.svg`
- **Modify:** `app/layout.tsx`
- **Modify:** `app/globals.css`
- **Create:** `components/MobileBottomNav.tsx`
- **Modify:** `components/Nav.tsx`

### 1.3 Step-by-Step Implementation

#### Step 1: Create `public/manifest.json`
Create [public/manifest.json](public/manifest.json):
```json
{
  "name": "Investments",
  "short_name": "Portfolio",
  "description": "Private portfolio dashboard and ledger",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121212",
  "theme_color": "#121212",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

#### Step 2: Create `public/icon.svg`
Create [public/icon.svg](public/icon.svg) with a geometric gold emblem on `#121212`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="108" fill="#121212"/>
  <rect x="24" y="24" width="464" height="464" rx="84" fill="#1a1a1a" stroke="#2e2e2e" stroke-width="4"/>
  <path d="M120 380 L200 280 L280 320 L392 150" fill="none" stroke="#d4a94a" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="392" cy="150" r="24" fill="#d4a94a"/>
</svg>
```

#### Step 3: Add Safe Area Utilities in `app/globals.css`
In [app/globals.css](app/globals.css) under `@layer utilities`:
```css
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
.mb-safe {
  margin-bottom: env(safe-area-inset-bottom, 0px);
}
```

#### Step 4: Configure Viewport & Manifest in `app/layout.tsx`
In [app/layout.tsx](app/layout.tsx):
1. Export a `viewport` object:
   ```ts
   import type { Metadata, Viewport } from "next";

   export const viewport: Viewport = {
     themeColor: "#121212",
     width: "device-width",
     initialScale: 1,
     maximumScale: 1,
     userScalable: false,
     viewportFit: "cover",
   };
   ```
2. Update `metadata`:
   ```ts
   export const metadata: Metadata = {
     title: "Investments",
     description: "Personal portfolio ledger and dashboard",
     manifest: "/manifest.json",
     appleWebApp: {
       capable: true,
       statusBarStyle: "black-translucent",
       title: "Investments",
     },
   };
   ```
3. Update `RootLayout` markup to include padding for the bottom bar and mount `MobileBottomNav`:
   ```tsx
   <div className="flex h-dvh flex-col overflow-hidden bg-ink-950">
     <Nav account={{ username: me?.username ?? null, canManage: view.ok }} />
     <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-4">
       {children}
     </main>
     <MobileBottomNav canManage={view.ok} />
     <CommandPalette />
   </div>
   ```

#### Step 5: Create `components/MobileBottomNav.tsx`
Create [components/MobileBottomNav.tsx](components/MobileBottomNav.tsx):
- `"use client"`
- Render fixed bar: `fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-ink-700 bg-ink-900/95 px-2 pb-safe backdrop-blur-md lg:hidden`
- Tabs list:
  1. `Today` (`/`) — Icon: `LayoutDashboard`
  2. `Positions` (`/positions`) — Icon: `Briefcase`
  3. `Performance` (`/performance`) — Icon: `TrendingUp`
  4. `Money` (`/money`) — Icon: `Wallet`
  5. `Watchlist` (`/watchlist`) — Icon: `Eye`
- Tapping a tab navigates using `next/link`.
- Active tab displays `text-accent`, inactive displays `text-ink-500 hover:text-ink-300`. Minimum height 48px per item.

#### Step 6: Streamline `components/Nav.tsx` for Mobile
In [components/Nav.tsx](components/Nav.tsx):
1. Remove `menuOpen` state, hamburger button, and the mobile collapsible `<ul>` dropdown.
2. In the top bar for mobile (`lg:hidden`):
   - Left side: Title indicator showing the current object (e.g., "Investments").
   - Right side: Search button triggering `OPEN_PALETTE_EVENT` and account chip linking to `/accounts`.

### 1.4 Verification & Acceptance Criteria
- Run `npm test` -> all 25 test files must pass.
- Run `npx tsc --noEmit` and `npx eslint app components lib tests scripts` -> 0 errors.
- Test at 390px viewport width:
  - Top hamburger is gone; top bar is a clean header.
  - Bottom navigation bar is visible, fixed, and highlights the active route.
  - Tapping each bottom nav icon routes cleanly.
  - Desktop view (1440px) is unaffected.

---

## Phase 2: Touch-First Mobile Cards for Holdings, Transactions & Watchlist

### 2.1 Goal
Replace wide tables on mobile with high-density, touch-optimized card rows that display all financial facts with zero horizontal document scroll.

### 2.2 Files to Modify
- **Modify:** [components/PositionsTable.tsx](components/PositionsTable.tsx)
- **Modify:** [components/TransactionsTable.tsx](components/TransactionsTable.tsx)
- **Modify:** [components/WatchlistPanel.tsx](components/WatchlistPanel.tsx)

### 2.3 Step-by-Step Implementation

#### Step 1: Holdings Mobile Cards in `components/PositionsTable.tsx`
In `RegionTable`:
1. Wrap the existing desktop table `<div className="table-scroll">...</div>` in `hidden lg:block`.
2. Add a mobile card list directly below it wrapped in `block lg:hidden`:
   ```tsx
   <div className="flex flex-col divide-y divide-ink-700/60 rounded-lg border border-ink-700 bg-ink-900 lg:hidden">
     {sorted.map((r) => {
       const isHit = highlightTicker !== null && r.ticker.toLowerCase() === highlightTicker.toLowerCase();
       return (
         <div
           key={`${r.region}-${r.ticker}`}
           onClick={() => onSelect({ region: r.region, ticker: r.ticker, currentPrice: r.currentPrice })}
           className={`flex flex-col gap-2 p-3.5 transition active:bg-ink-800 ${isHit ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : ""}`}
           role="button"
           tabIndex={0}
         >
           <div className="flex items-start justify-between gap-2">
             <div className="min-w-0 flex-1">
               <div className="flex items-center gap-1.5">
                 <span className="num text-base font-semibold text-ink-100">{r.ticker}</span>
                 <RegionFlag region={r.region} />
                 {r.priceUnavailable && (
                   <span className="rounded bg-ink-800 px-1 py-0.5 text-[10px] text-ink-500">at cost</span>
                 )}
               </div>
               {r.name && <p className="truncate text-xs text-ink-300">{r.name}</p>}
             </div>
             <div className="text-right">
               <p className="num text-base font-medium text-ink-100">{symbol}{formatAmount(r.totalHoldings)}</p>
               <p className="num text-xs text-ink-500">{shares(r.qty)}</p>
             </div>
           </div>

           <div className="flex items-baseline justify-between gap-2 border-t border-ink-800/80 pt-2 text-xs">
             <div className="flex items-baseline gap-1.5">
               <span className="num text-ink-300">{symbol}{formatAmount(r.currentPrice)}</span>
               <span className="text-ink-500">· avg {symbol}{formatAmount(r.avgCost)}</span>
             </div>
             <div className="flex items-baseline gap-2 text-right">
               {r.priceUnavailable ? (
                 <span className="text-ink-500">N/A</span>
               ) : (
                 <span className="num font-medium">
                   <NativeMoney value={r.unrealizedPL} symbol={symbol} showPlus />
                   {" "}
                   <span className="text-[11px]">(<Percent value={r.unrealizedPLPct} />)</span>
                 </span>
               )}
               <span className="num text-ink-500">· <PlainPercent value={r.portfolioPct} /></span>
             </div>
           </div>
         </div>
       );
     })}
   </div>
   ```

#### Step 2: Transactions Mobile Cards in `components/TransactionsTable.tsx`
In `TransactionsTable`:
1. Wrap desktop `<table className="ledger-table">...</table>` in `hidden lg:table`.
2. Add a mobile list with `block lg:hidden`:
   - Each card features:
     - Header: Action pill (`Buy` with `badge-gain`, `Sell` with `badge-loss`), Ticker, Flag, Date (`formatShortDate(new Date(t.date))`).
     - Figures row: `t.qty` shares @ `t.price` on the left, Transaction Value `PlainMoney` on the right.
     - Notes/Derived execution row: Render using `<LedgerLine parts={...} note={...} />`.

#### Step 3: Watchlist Mobile Cards in `components/WatchlistPanel.tsx`
In `WatchlistPanel`:
1. Wrap `<table className="ledger-table table-compact table-fixed">` in `hidden md:table`.
2. Add mobile cards for viewports `< md`:
   - Ticker + Flag + Name.
   - Price and Session change (`Percent`).
   - 30-day sparkline and 1Y range bar.
   - Expandable trigger to reveal RSI, moving averages, and notes.

### 2.4 Verification & Acceptance Criteria
- Run `npm test` -> 25 test files pass.
- Measure viewport width at 375px:
  - `document.documentElement.scrollWidth === document.documentElement.clientWidth` (exactly 0px overflow).
  - Holdings and ledger rows display cleanly on mobile with zero horizontal scrolling.
  - Tapping a holding card opens `TransactionHistoryModal`.

---

## Phase 3: Mobile Bottom Sheets (Modal Dialogs & Entry Forms)

### 3.1 Goal
Replace desktop-centered popups and horizontal forms with slide-up bottom sheets that feel natural on phone screens.

### 3.2 Files to Modify
- **Modify:** [components/TransactionHistoryModal.tsx](components/TransactionHistoryModal.tsx)
- **Modify:** [components/AddTransactionForm.tsx](components/AddTransactionForm.tsx)
- **Modify:** [components/AddContributionForm.tsx](components/AddContributionForm.tsx)

### 3.3 Step-by-Step Implementation

#### Step 1: Bottom Sheet for `components/TransactionHistoryModal.tsx`
1. Update outer modal wrapper:
   ```tsx
   <div
     className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4 backdrop-blur-[2px]"
     onClick={onClose}
   >
     <div
       ref={dialogRef}
       role="dialog"
       aria-modal="true"
       tabIndex={-1}
       className="panel flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-b-none border-b-0 sm:rounded-b-lg sm:border-b outline-none pb-safe"
       onClick={(e) => e.stopPropagation()}
     >
       {/* Mobile pull handle */}
       <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink-700 sm:hidden" />
   ```
2. In `TradeSection`, wrap the inner cycle table so that on mobile it stacks cleanly rather than overflowing.

#### Step 2: Slide-Up Form for `components/AddTransactionForm.tsx`
When `open === true`:
- On desktop (`sm:relative sm:inset-auto sm:p-4 sm:flex-wrap`): Keep inline horizontal layout.
- On mobile: Present as a slide-up sheet anchored to the bottom (`fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-[2px]`), with large touch-friendly inputs (`min-h-[44px]`), date picker, and pinned action buttons.

#### Step 3: Slide-Up Form for `components/AddContributionForm.tsx`
Apply the same responsive pattern: inline panel on desktop, slide-up sheet on mobile.

### 3.4 Verification & Acceptance Criteria
- Tap any holding on mobile: Sheet slides up from the bottom with a pull handle.
- Tap "Log a transaction": Full-screen/bottom-sheet modal opens without layout breaking.
- Escape key or tapping outside dismisses the sheet.

---

## Phase 4: Ergonomics, Touch Targets & Mobile Polish

### 4.1 Goal
Finalize touch targets (≥44px), refine mobile stat strips, and ensure sub-navigation scrolls horizontally without wrapping.

### 4.2 Files to Modify
- **Modify:** [components/SectionTabs.tsx](components/SectionTabs.tsx)
- **Modify:** [app/globals.css](app/globals.css)
- **Modify:** [components/SlideDeck.tsx](components/SlideDeck.tsx)

### 4.3 Step-by-Step Implementation

#### Step 1: Smooth Scrolling Sub-Tabs in `components/SectionTabs.tsx`
- Ensure `<nav>` on mobile does not wrap into awkward stacked rows. Add `overflow-x-auto no-scrollbar` to the tab track wrapper so tabs scroll horizontally if space is constrained.
- Maintain `useSlidingPill` calculation.

#### Step 2: Touch Targets (44×44px)
- Audit all button and icon elements on mobile to guarantee minimum hit area of 44×44px using padding or `min-h-[44px] min-w-[44px]`.

#### Step 3: Polish Mobile Stat Grid in `app/globals.css`
In [app/globals.css](app/globals.css), ensure `.stat-strip` on mobile formats into an organized 2-column grid:
```css
.stat-strip {
  @apply grid w-full grid-cols-2 gap-2.5 rounded-lg border border-ink-700 bg-ink-900 p-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 sm:border-0 sm:bg-transparent sm:p-0;
}
```

### 4.4 Verification & Acceptance Criteria
- Run full automated test battery:
  ```bash
  npm test
  npx tsc --noEmit
  npx eslint app components lib tests scripts
  npm run build
  ```
- All checks pass with 0 errors.
- Verify across desktop (1440×900, 1024×600) and mobile (375px, 390px): 0px overflow, flawless touch navigation.
