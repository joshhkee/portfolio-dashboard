// Core calculation engine.
//
// Replays every Buy/Sell transaction, per (region, ticker), in
// chronological order to derive:
//   - open positions (qty > 0 remaining) with weighted-average cost basis
//   - completed trades (every Sell), with realized P/L at time of sale
//
// Weighted-average cost basis, with the "reset after full exit" behaviour
// your sheet had: when a position's running qty hits 0, the *next* Buy
// naturally starts its average from that buy's own price (since the
// weighted-average formula collapses to just the new price when the
// existing qty is 0) — no separate reset step needed.

export type TxnAction = "Buy" | "Sell";

export interface RawTransaction {
  id: number;
  date: Date;
  action: TxnAction;
  ticker: string;
  region: string;
  qty: number;
  price: number;
  notes?: string | null;
}

export interface OpenPosition {
  region: string;
  ticker: string;
  qty: number;
  avgCost: number;
}

export interface CompletedTrade {
  id: number;
  sellDate: Date;
  region: string;
  ticker: string;
  qtySold: number;
  avgCost: number;
  sellPrice: number;
  realizedPL: number;
  returnPct: number; // e.g. 0.15 for 15%
  notes?: string | null;
}

export interface LedgerRow extends RawTransaction {
  runningQty: number;
  runningAvgCost: number;
  transactionValue: number;
}

export interface EngineResult {
  ledger: LedgerRow[]; // one row per transaction, in the order shown in the Transaction Ledger tab
  openPositions: OpenPosition[];
  completedTrades: CompletedTrade[];
}

const EPSILON = 1e-6;

/** Shape of a row as it comes back from `prisma.transaction.findMany()`. */
export interface DbTransactionRow {
  id: number;
  date: Date;
  action: string;
  ticker: string;
  region: string;
  qty: number;
  price: number;
  notes: string | null;
}

/** Convert raw DB rows into the shape computeLedger() expects. */
export function fromDbRows(rows: DbTransactionRow[]): RawTransaction[] {
  return rows.map((t) => ({
    id: t.id,
    date: t.date,
    action: t.action as TxnAction,
    ticker: t.ticker,
    region: t.region,
    qty: t.qty,
    price: t.price,
    notes: t.notes,
  }));
}

function groupKey(t: Pick<RawTransaction, "region" | "ticker">) {
  return `${t.region}::${t.ticker}`;
}

export function computeLedger(transactions: RawTransaction[]): EngineResult {
  // Sort chronologically; fall back to insertion id to keep same-day
  // entries in the order they were recorded.
  const sorted = [...transactions].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.id - b.id;
  });

  const state = new Map<string, { qty: number; avgCost: number }>();
  const ledger: LedgerRow[] = [];
  const completedTrades: CompletedTrade[] = [];

  for (const t of sorted) {
    const key = groupKey(t);
    const prev = state.get(key) ?? { qty: 0, avgCost: 0 };

    if (t.action === "Buy") {
      const newQty = prev.qty + t.qty;
      const newAvgCost =
        newQty === 0 ? 0 : (prev.qty * prev.avgCost + t.qty * t.price) / newQty;
      state.set(key, { qty: newQty, avgCost: newAvgCost });

      ledger.push({
        ...t,
        runningQty: newQty,
        runningAvgCost: newAvgCost,
        transactionValue: t.qty * t.price,
      });
    } else {
      // Sell — realize P/L against the average cost carried into this sale.
      const avgCostAtSale = prev.avgCost;
      const realizedPL = (t.price - avgCostAtSale) * t.qty;
      const returnPct = avgCostAtSale === 0 ? 0 : (t.price - avgCostAtSale) / avgCostAtSale;
      const newQty = prev.qty - t.qty;
      // Average cost carries forward unchanged (it's meaningless once qty
      // hits 0 — the next Buy will overwrite it from scratch).
      state.set(key, { qty: newQty, avgCost: avgCostAtSale });

      ledger.push({
        ...t,
        runningQty: newQty,
        runningAvgCost: avgCostAtSale,
        transactionValue: t.qty * t.price,
      });

      completedTrades.push({
        id: t.id,
        sellDate: t.date,
        region: t.region,
        ticker: t.ticker,
        qtySold: t.qty,
        avgCost: avgCostAtSale,
        sellPrice: t.price,
        realizedPL,
        returnPct,
        notes: t.notes,
      });
    }
  }

  const openPositions: OpenPosition[] = [];
  for (const [key, s] of state.entries()) {
    if (s.qty > EPSILON) {
      const [region, ticker] = key.split("::");
      openPositions.push({ region, ticker, qty: s.qty, avgCost: s.avgCost });
    }
  }

  // Re-sort ledger/completedTrades back into the order the ledger tab
  // should read: chronological, matching how transactions were entered.
  ledger.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
  completedTrades.sort(
    (a, b) => a.sellDate.getTime() - b.sellDate.getTime() || a.id - b.id
  );

  return { ledger, openPositions, completedTrades };
}

/** Attach live prices and derived unrealized P/L to a set of open positions. All figures are in the position's native currency — USD conversion and portfolio-% aggregation across currencies happens one layer up (see lib/fx.ts and lib/get-positions.ts), since mixing e.g. SGD and HKD totals directly would be meaningless. */
export function withLivePrices(
  positions: OpenPosition[],
  prices: Record<string, number>
) {
  return positions.map((p) => {
    const currentPrice = prices[p.ticker] ?? p.avgCost; // fall back to cost if quote missing
    const totalHoldings = p.qty * currentPrice;
    const unrealizedPL = (currentPrice - p.avgCost) * p.qty;
    const unrealizedPLPct =
      p.avgCost === 0 ? 0 : (currentPrice - p.avgCost) / p.avgCost;
    return {
      ...p,
      currentPrice,
      totalHoldings,
      unrealizedPL,
      unrealizedPLPct,
    };
  });
}

/**
 * Would applying this new transaction on top of the existing ones push
 * any (region, ticker) position's running quantity below zero? Used to
 * block over-sell data entry mistakes before they corrupt the ledger.
 * Returns the offending position's resulting qty if so, otherwise null.
 */
export function findNegativeQtyAfter(
  existing: RawTransaction[],
  candidate: RawTransaction
): number | null {
  const { openPositions, ledger } = computeLedger([...existing, candidate]);
  const key = groupKey(candidate);
  // openPositions only lists qty > 0, so look at the full ledger's last
  // row for this key to get the true (possibly negative) resulting qty.
  const rowsForKey = ledger.filter((r) => groupKey(r) === key);
  const last = rowsForKey[rowsForKey.length - 1];
  if (last && last.runningQty < -EPSILON) return last.runningQty;
  return null;
}

/**
 * Broader version of the same guard, used when *editing* an existing
 * transaction rather than appending a new one — an edit can change a
 * Buy's qty/date too, which can push a *later* Sell negative even though
 * the edited row itself isn't a Sell. Replays the whole ledger and
 * returns the first (region, ticker) row that goes negative anywhere,
 * not just the resulting final qty for one key.
 */
export function findFirstNegativeQty(
  transactions: RawTransaction[]
): { region: string; ticker: string; runningQty: number } | null {
  const { ledger } = computeLedger(transactions);
  for (const row of ledger) {
    if (row.runningQty < -EPSILON) {
      return { region: row.region, ticker: row.ticker, runningQty: row.runningQty };
    }
  }
  return null;
}