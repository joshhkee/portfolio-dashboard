"use client";

import { useEffect, useState } from "react";
import { currencySymbol, currencyForRegion, convertCurrency, type FxRates } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import { formatQty, Percent, NativeMoney } from "@/components/SignedNumber";

interface HistoryRow {
  id: number;
  date: string;
  action: "Buy" | "Sell";
  ticker: string;
  region: string;
  qty: number;
  price: number;
  notes?: string | null;
  runningQty: number;
  runningAvgCost: number;
  transactionValue: number;
}

interface Trade {
  cycle: HistoryRow[];
  tradeNumber: number;
  isOpen: boolean;
}

const EPSILON = 1e-6;

/** Splits a ticker's full history into cycles at each point the running
 * qty returns to (about) zero — i.e. the position was fully closed
 * before being bought into again. The last cycle, if non-empty, is
 * still open. */
function splitIntoCycles(rows: HistoryRow[]) {
  const closedCycles: HistoryRow[][] = [];
  let current: HistoryRow[] = [];
  for (const row of rows) {
    current.push(row);
    if (Math.abs(row.runningQty) <= EPSILON) {
      closedCycles.push(current);
      current = [];
    }
  }
  return { closedCycles, openCycle: current };
}

interface CycleStats {
  avgBuyCost: number;
  hasSells: boolean;
  avgSellCost: number;
  realizedPLNative: number;
  realizedPLPct: number;
  remainingQty: number;
}

/** Sell rows don't change the running average, so a Sell row's own
 * runningAvgCost is exactly the cost basis that sale was realized
 * against — matches how the engine computes completedTrades. */
function computeCycleStats(rows: HistoryRow[]): CycleStats {
  const sells = rows.filter((r) => r.action === "Sell");
  const last = rows[rows.length - 1];

  let totalSellQty = 0;
  let totalSellValue = 0;
  let totalRealizedPL = 0;
  let totalCostBasisSold = 0;
  for (const row of sells) {
    totalSellQty += row.qty;
    totalSellValue += row.qty * row.price;
    totalRealizedPL += (row.price - row.runningAvgCost) * row.qty;
    totalCostBasisSold += row.runningAvgCost * row.qty;
  }

  return {
    avgBuyCost: last?.runningAvgCost ?? 0,
    hasSells: sells.length > 0,
    avgSellCost: totalSellQty > 0 ? totalSellValue / totalSellQty : 0,
    realizedPLNative: totalRealizedPL,
    realizedPLPct: totalCostBasisSold > 0 ? totalRealizedPL / totalCostBasisSold : 0,
    remainingQty: last?.runningQty ?? 0,
  };
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <dt className="text-ink-300">{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}

function TradeSection({
  trade,
  ticker,
  symbol,
  rates,
  region,
  currentPrice,
}: {
  trade: Trade;
  ticker: string;
  symbol: string;
  rates: FxRates | null;
  region: string;
  currentPrice: number;
}) {
  const stats = computeCycleStats(trade.cycle);
  const sgdSymbol = currencySymbol.SGD;
  const currency = currencyForRegion(region);

  const unrealizedPLNative = (currentPrice - stats.avgBuyCost) * stats.remainingQty;
  const unrealizedPLPct = stats.avgBuyCost > 0 ? (currentPrice - stats.avgBuyCost) / stats.avgBuyCost : 0;

  return (
    <div className="mb-8 last:mb-0">
      <p className="mb-2 text-sm font-medium text-ink-100">
        {ticker} Trade {trade.tradeNumber} ({trade.isOpen ? "open" : "closed"})
      </p>
      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Running qty</th>
              <th className="text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {trade.cycle.map((row) => (
              <tr key={row.id}>
                <td className="num text-ink-300">{formatShortDate(new Date(row.date))}</td>
                <td className={row.action === "Buy" ? "text-gain" : "text-loss"}>{row.action}</td>
                <td className="num">{formatQty(row.qty)}</td>
                <td className="num">
                  {symbol}
                  {row.price.toFixed(2)}
                </td>
                <td className="num">{formatQty(row.runningQty)}</td>
                <td className="max-w-[16rem] truncate text-left text-ink-300" title={row.notes ?? undefined}>
                  {row.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <StatRow label="Avg buy cost">
          {symbol}
          {stats.avgBuyCost.toFixed(2)}
        </StatRow>

        {stats.hasSells && (
          <>
            <StatRow label="Avg sell cost">
              {symbol}
              {stats.avgSellCost.toFixed(2)}
            </StatRow>
            <StatRow label="Realised P/L (%)">
              <Percent value={stats.realizedPLPct} />
            </StatRow>
            <StatRow label={`Realised P/L (${currency})`}>
              <NativeMoney value={stats.realizedPLNative} symbol={symbol} showPlus />
            </StatRow>
            <StatRow label="Realised P/L (SGD)">
              {rates ? (
                <NativeMoney
                  value={convertCurrency(stats.realizedPLNative, region, "SGD", rates)}
                  symbol={sgdSymbol}
                  showPlus
                />
              ) : (
                "—"
              )}
            </StatRow>
          </>
        )}

        {trade.isOpen && (
          <>
            <StatRow label="Unrealised P/L (%)">
              <Percent value={unrealizedPLPct} />
            </StatRow>
            <StatRow label={`Unrealised P/L (${currency})`}>
              <NativeMoney value={unrealizedPLNative} symbol={symbol} showPlus />
            </StatRow>
            <StatRow label="Unrealised P/L (SGD)">
              {rates ? (
                <NativeMoney
                  value={convertCurrency(unrealizedPLNative, region, "SGD", rates)}
                  symbol={sgdSymbol}
                  showPlus
                />
              ) : (
                "—"
              )}
            </StatRow>
          </>
        )}
      </dl>
    </div>
  );
}

export default function TransactionHistoryModal({
  region,
  ticker,
  currentPrice,
  onClose,
}: {
  region: string;
  ticker: string;
  currentPrice: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [rates, setRates] = useState<FxRates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions?region=${encodeURIComponent(region)}&ticker=${encodeURIComponent(ticker)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load transaction history");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setRows(data.ledger);
          setRates(data.rates);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      });
    return () => {
      cancelled = true;
    };
  }, [region, ticker]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const symbol = currencySymbol[currencyForRegion(region)];

  let trades: Trade[] = [];
  if (rows) {
    const { closedCycles, openCycle } = splitIntoCycles(rows);
    const tradeCount = closedCycles.length + (openCycle.length > 0 ? 1 : 0);
    const closedTrades: Trade[] = closedCycles.map((cycle, i) => ({
      cycle,
      tradeNumber: i + 1,
      isOpen: false,
    }));
    const openTrade: Trade[] =
      openCycle.length > 0 ? [{ cycle: openCycle, tradeNumber: tradeCount, isOpen: true }] : [];
    // Flipped order: open position first, then closed trades most-recent-first.
    trades = [...openTrade, ...closedTrades.slice().reverse()];
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div>
            <p className="text-sm text-ink-300">Transaction history</p>
            <p className="num text-lg font-medium">
              {ticker} <span className="text-ink-300">· {region}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-300 hover:text-ink-100"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto p-5">
          {error && <p className="text-sm text-loss">{error}</p>}
          {!error && !rows && <p className="text-sm text-ink-300">Loading…</p>}
          {!error && rows && rows.length === 0 && (
            <p className="text-sm text-ink-300">No transactions found for this position.</p>
          )}
          {!error &&
            rows &&
            trades.map((trade) => (
              <TradeSection
                key={`${trade.isOpen ? "open" : "closed"}-${trade.tradeNumber}`}
                trade={trade}
                ticker={ticker}
                symbol={symbol}
                rates={rates}
                region={region}
                currentPrice={currentPrice}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
