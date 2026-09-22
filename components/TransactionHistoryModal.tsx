"use client";

import { useEffect, useState } from "react";
import { currencySymbol, currencyForRegion, convertCurrency, type FxRates } from "@/lib/fx";
import { X } from "lucide-react";
import RegionFlag from "@/components/RegionFlag";
import { formatShortDate, formatHoldingPeriod } from "@/lib/dates";
import { formatQty, formatAmount, NativeMoney } from "@/components/SignedNumber";
import { classifyNote, ledgerSummary } from "@/lib/notes";

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
  /** Position state carried INTO this row — what the derived ledger line needs
   *  to say whether a buy opened the position or added to it. */
  qtyBefore: number;
  avgCostBefore: number;
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

/** The big "won or lost" headline number for a trade — a percentage,
 * colored gain/loss, sized to be the first thing you notice in the
 * section. */
function HeadlinePL({ label, pct }: { label: string; pct: number }) {
  const positive = pct > 0;
  const negative = pct < 0;
  return (
    <div>
      <p className="text-xs text-ink-300">{label}</p>
      {/* `text-2xl` on a phone: this headline shares its row with the cost
          boxes, and at text-3xl the row measured wider than the viewport. */}
      <p className={`num text-2xl font-semibold sm:text-3xl ${positive ? "text-gain" : negative ? "text-loss" : "text-ink-100"}`}>
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
  companyName,
}: {
  trade: Trade;
  symbol: string;
  rates: FxRates | null;
  region: string;
  currentPrice: number;
  companyName: string | null;
}) {
  const stats = computeCycleStats(trade.cycle);
  const sgdSymbol = currencySymbol.SGD;
  const currency = currencyForRegion(region);
  // SG stocks are already natively SGD — showing both the "native" and
  // "SGD" P/L lines would just repeat the same number twice.
  const nativeIsSgd = currency === "SGD";

  const unrealizedPLNative = (currentPrice - stats.avgBuyCost) * stats.remainingQty;
  const unrealizedPLPct = stats.avgBuyCost > 0 ? (currentPrice - stats.avgBuyCost) / stats.avgBuyCost : 0;

  const firstDate = new Date(trade.cycle[0].date);
  const lastDate = new Date(trade.cycle[trade.cycle.length - 1].date);
  const holdingPeriod = trade.isOpen
    ? formatHoldingPeriod(firstDate)
    : formatHoldingPeriod(firstDate, lastDate);

  return (
    <div className="py-6 first:pt-0">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-100">
          {trade.cycle[0]?.ticker} Trade {trade.tradeNumber} ({trade.isOpen ? "open" : "closed"})
        </p>
        <p className="text-xs text-ink-300">Held {holdingPeriod}</p>
      </div>
      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Running qty</th>
              <th className="text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {trade.cycle.map((row) => {
              const note = classifyNote(row.notes, { ticker: row.ticker, name: companyName });
              const derived = ledgerSummary(row, symbol);
              return (
              <tr key={row.id}>
                <td className="num text-ink-300">{formatShortDate(new Date(row.date))}</td>
                <td className={row.action === "Buy" ? "text-gain" : "text-loss"}>{row.action}</td>
                <td className="num text-right">{formatQty(row.qty)}</td>
                <td className="num text-right">
                  {symbol}
                  {formatAmount(row.price)}
                </td>
                <td className="num text-right">{formatQty(row.runningQty)}</td>
                {/* Same rule as the ledger table: the owner's note if there is
                    one, otherwise the line the ledger derives from the row. */}
                <td
                  className={`max-w-[16rem] truncate text-left ${
                    note.note ? "text-ink-300" : "text-ink-500"
                  }`}
                  title={note.note ? `${note.note} — ${derived}` : derived}
                >
                  {note.note ?? derived}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
                  companyName={companyName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
