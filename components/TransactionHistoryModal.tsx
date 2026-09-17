"use client";

import { useEffect, useState } from "react";
import { currencySymbol, currencyForRegion, convertCurrency, type FxRates } from "@/lib/fx";
import { X } from "lucide-react";
import { formatShortDate, formatHoldingPeriod } from "@/lib/dates";
import { formatQty, formatAmount, Percent, NativeMoney } from "@/components/SignedNumber";
import RegionFlag from "@/components/RegionFlag";

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
  ticker: string;
  cycle: HistoryRow[];
  tradeNumber: number;
  isOpen: boolean;
  // Only set when this trade has no rows of its own yet — a partial
  // sell in the previous (closed) trade left shares over with nothing
  // bought or sold against them since.
  carry: { qty: number; avgCost: number } | null;
}

const EPSILON = 1e-6;

/** Splits a ticker's full history into trades. Every trade that ends in
 * a Sell is "closed", whether or not that sell fully zeroed the
 * position — selling part of a holding closes that batch's story with
 * a realized P/L, and whatever's left immediately starts a new trade,
 * open, carrying over its qty and avg cost even if nothing further has
 * happened to it yet. A Buy never closes a trade. */
function splitIntoCycles(rows: HistoryRow[]) {
  const closedCycles: HistoryRow[][] = [];
  let current: HistoryRow[] = [];
  let carry: { qty: number; avgCost: number } | null = null;

  for (const row of rows) {
    current.push(row);
    if (row.action === "Sell") {
      closedCycles.push(current);
      current = [];
      carry = row.runningQty > EPSILON ? { qty: row.runningQty, avgCost: row.runningAvgCost } : null;
    } else {
      // Real activity (a Buy) in the new trade — its own last row will
      // carry the correct running qty/avg cost, so the fallback isn't
      // needed anymore.
      carry = null;
    }
  }

  return { closedCycles, openCycle: current, carry };
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
 * against — matches how the engine computes completedTrades. `carry`
 * is the fallback for a trade with no rows of its own yet (see
 * splitIntoCycles). */
function computeCycleStats(rows: HistoryRow[], carry: { qty: number; avgCost: number } | null): CycleStats {
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
    avgBuyCost: last?.runningAvgCost ?? carry?.avgCost ?? 0,
    hasSells: sells.length > 0,
    avgSellCost: totalSellQty > 0 ? totalSellValue / totalSellQty : 0,
    realizedPLNative: totalRealizedPL,
    realizedPLPct: totalCostBasisSold > 0 ? totalRealizedPL / totalCostBasisSold : 0,
    remainingQty: last?.runningQty ?? carry?.qty ?? 0,
  };
}

/** The big "won or lost" headline number for a trade — a percentage,
 * colored gain/loss, sized to be the first thing you notice in the
 * section. */
function HeadlinePL({ label, pct }: { label: string; pct: number }) {
  const positive = pct > 0;
  const negative = pct < 0;
  return (
    <div>
      <p className="text-xs text-ink-300">{label}</p>
      <p className={`num text-3xl font-semibold ${positive ? "text-gain" : negative ? "text-loss" : "text-ink-100"}`}>
        {pct >= 0 ? "+" : ""}
        {(pct * 100).toFixed(2)}%
      </p>
    </div>
  );
}

function CostBox({ label, symbol, value }: { label: string; symbol: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-ink-300">{label}</p>
      <p className="num text-base">
        {symbol}
        {formatAmount(value)}
      </p>
    </div>
  );
}

function SubStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-ink-300">{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}

function TradeSection({
  trade,
  symbol,
  rates,
  region,
  currentPrice,
}: {
  trade: Trade;
  symbol: string;
  rates: FxRates | null;
  region: string;
  currentPrice: number;
}) {
  const stats = computeCycleStats(trade.cycle, trade.carry);
  const sgdSymbol = currencySymbol.SGD;
  const currency = currencyForRegion(region);
  // SG stocks are already natively SGD — showing both the "native" and
  // "SGD" P/L lines would just repeat the same number twice.
  const nativeIsSgd = currency === "SGD";

  const unrealizedPLNative = (currentPrice - stats.avgBuyCost) * stats.remainingQty;
  const unrealizedPLPct = stats.avgBuyCost > 0 ? (currentPrice - stats.avgBuyCost) / stats.avgBuyCost : 0;

  const hasRows = trade.cycle.length > 0;
  const firstDate = hasRows ? new Date(trade.cycle[0].date) : null;
  const lastDate = hasRows ? new Date(trade.cycle[trade.cycle.length - 1].date) : null;
  const holdingPeriod = firstDate
    ? trade.isOpen
      ? formatHoldingPeriod(firstDate)
      : formatHoldingPeriod(firstDate, lastDate!)
    : null;

  return (
    <div className="py-6 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-100">
          {trade.ticker} Trade {trade.tradeNumber} ({trade.isOpen ? "open" : "closed"})
        </p>
        {holdingPeriod && <p className="text-xs text-ink-300">Held {holdingPeriod}</p>}
      </div>

      {hasRows ? (
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Running qty</th>
                <th className="text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {trade.cycle.map((row) => (
                <tr key={row.id}>
                  <td className="num text-ink-300">{formatShortDate(new Date(row.date))}</td>
                  <td className={row.action === "Buy" ? "text-gain" : "text-loss"}>{row.action}</td>
                  <td className="num text-right">{formatQty(row.qty)}</td>
                  <td className="num text-right">
                    {symbol}
                    {formatAmount(row.price)}
                  </td>
                  <td className="num text-right">{formatQty(row.runningQty)}</td>
                  <td className="max-w-[16rem] truncate text-left text-ink-300" title={row.notes ?? undefined}>
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-300">
          {formatQty(stats.remainingQty)} shares carried over from the previous trade — no new
          activity yet.
        </p>
      )}

      {/* Buy vs sell cost, side by side so the gap between them is easy
          to read at a glance. */}
      <div className="mt-4 flex gap-8 rounded-sm border border-ink-800 p-3">
        <CostBox label="Avg buy cost" symbol={symbol} value={stats.avgBuyCost} />
        {stats.hasSells && <CostBox label="Avg sell cost" symbol={symbol} value={stats.avgSellCost} />}
      </div>

      {stats.hasSells && (
        <div className="mt-4">
          <HeadlinePL label="Realised P/L" pct={stats.realizedPLPct} />
          <dl className="mt-2 flex flex-col gap-1">
            {!nativeIsSgd && (
              <SubStat label={`Realised P/L (${currency})`}>
                <NativeMoney value={stats.realizedPLNative} symbol={symbol} showPlus />
              </SubStat>
            )}
            <SubStat label="Realised P/L (SGD)">
              {rates ? (
                <NativeMoney
                  value={convertCurrency(stats.realizedPLNative, region, "SGD", rates)}
                  symbol={sgdSymbol}
                  showPlus
                />
              ) : (
                "—"
              )}
            </SubStat>
          </dl>
        </div>
      )}

      {trade.isOpen && (
        <div className="mt-4">
          <HeadlinePL label="Unrealised P/L" pct={unrealizedPLPct} />
          <dl className="mt-2 flex flex-col gap-1">
            {!nativeIsSgd && (
              <SubStat label={`Unrealised P/L (${currency})`}>
                <NativeMoney value={unrealizedPLNative} symbol={symbol} showPlus />
              </SubStat>
            )}
            <SubStat label="Unrealised P/L (SGD)">
              {rates ? (
                <NativeMoney
                  value={convertCurrency(unrealizedPLNative, region, "SGD", rates)}
                  symbol={sgdSymbol}
                  showPlus
                />
              ) : (
                "—"
              )}
            </SubStat>
          </dl>
        </div>
      )}
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
  const [companyName, setCompanyName] = useState<string | null>(null);
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
          setCompanyName(data.companyName ?? null);
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
    const { closedCycles, openCycle, carry } = splitIntoCycles(rows);
    const hasOpenTrade = openCycle.length > 0 || carry !== null;
    const tradeCount = closedCycles.length + (hasOpenTrade ? 1 : 0);
    const closedTrades: Trade[] = closedCycles.map((cycle, i) => ({
      ticker,
      cycle,
      tradeNumber: i + 1,
      isOpen: false,
      carry: null,
    }));
    const openTrade: Trade[] = hasOpenTrade
      ? [{ ticker, cycle: openCycle, tradeNumber: tradeCount, isOpen: true, carry }]
      : [];
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
            <p className="text-lg font-medium text-ink-100">{companyName || ticker}</p>
            <p className="num text-xs text-ink-300">
              {ticker} · <RegionFlag region={region} className="mr-0.5" />{region}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-300 hover:text-ink-100"
            title="Close"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-auto p-5">
          {error && <p className="text-sm text-loss">{error}</p>}
          {!error && !rows && <p className="text-sm text-ink-300">Loading…</p>}
          {!error && rows && rows.length === 0 && (
            <p className="text-sm text-ink-300">No transactions found for this position.</p>
          )}
          {!error && rows && (
            <div className="divide-y divide-ink-700">
              {trades.map((trade) => (
                <TradeSection
                  key={`${trade.isOpen ? "open" : "closed"}-${trade.tradeNumber}`}
                  trade={trade}
                  symbol={symbol}
                  rates={rates}
                  region={region}
                  currentPrice={currentPrice}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
