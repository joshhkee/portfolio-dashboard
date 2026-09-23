"use client";

import { useEffect, useRef, useState } from "react";
import { currencySymbol, currencyForRegion, convertCurrency, type FxRates } from "@/lib/fx";
import { X } from "lucide-react";
import RegionFlag from "@/components/RegionFlag";
import { formatShortDate, formatHoldingPeriod } from "@/lib/dates";
import { formatQty, formatAmount, NativeMoney } from "@/components/SignedNumber";
import { classifyNote, ledgerSummary } from "@/lib/notes";
import LedgerLine from "@/components/LedgerLine";

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
  /** What the sold shares cost — the denominator of `realizedPLPct`, kept
   *  rather than recovered from it so cycles can be combined exactly. */
  costBasisSold: number;
  /** What those shares SOLD for. Together with `costBasisSold` it is the two
   *  terms the realised figure is the difference of, which is why the footer
   *  shows all three: the return can then be checked rather than believed. */
  proceeds: number;
  /** How many shares were sold across the cycle — the "of" in "10 of 15". */
  soldQty: number;
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
    costBasisSold: totalCostBasisSold,
    proceeds: totalSellValue,
    soldQty: totalSellQty,
    remainingQty: last?.runningQty ?? 0,
  };
}

/** The colour rule, applied once: a gain or a loss is coloured, and a value
 *  that is neither (an average cost, a share count) is not. */
function plTone(pct: number): string {
  return pct > 0 ? "text-gain" : pct < 0 ? "text-loss" : "text-ink-100";
}

function signedPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(2)}%`;
}

/**
 * The second line under a profit/loss figure: the return it is, then the same
 * money in SGD where that is a different currency from the one the trade
 * settled in.
 *
 * Two facts on one line, in that order, because the percentage is the answer to
 * "how did this do" and the conversion is the footnote to it. For SG holdings
 * the conversion is the same number twice, so it is dropped rather than shown
 * beside itself.
 */
function plHint(
  pct: number,
  native: number,
  { region, rates, nativeIsSgd }: { region: string; rates: FxRates | null; nativeIsSgd: boolean }
): string {
  const parts = [signedPct(pct)];
  if (!nativeIsSgd && rates) {
    const sgd = convertCurrency(native, region, "SGD", rates);
    parts.push(`${sgd < 0 ? "-" : "+"}${currencySymbol.SGD}${formatAmount(Math.abs(sgd))}`);
  }
  return parts.join(" · ");
}

/** One label/value pair in the summary strip. */
function SummaryStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-300">{label}</p>
      <p className={`num text-base ${tone ?? ""}`}>{value}</p>
      {hint && <p className="num text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * One figure in a trade's breakdown, label directly above its value.
 *
 * The layout this replaced put the label on the left edge of the panel and the
 * figure on the right, justified apart — "Realised P/L (USD)" and its amount
 * sat roughly 800px from each other on a desktop, so pairing them meant reading
 * across an empty row, and the eye lost the connection on the way. Stacking is
 * the same pattern the summary strip and the chart stat rows already use, so it
 * is also the consistent one: the label is the heading of the number under it,
 * and the distance between them is a few pixels at any width.
 *
 * `hint` is the second line — a percentage or the SGD equivalent — which is
 * what the freed-up horizontal room is spent on rather than whitespace. */
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-ink-300">{label}</p>
      <p className="num text-base">{value}</p>
      {hint && <p className="num text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * The position at a glance, above the cycles that make it up.
 *
 * Every figure is already computed below for one cycle or another; the strip
 * exists because the question you open this modal with ("where do I stand in
 * this thing") was previously only answerable by reading every trade down the
 * page. Nothing here is a new input the app does not have.
 */
function SummaryStrip({
  trades,
  symbol,
  region,
  rates,
  currentPrice,
}: {
  trades: Trade[];
  symbol: string;
  region: string;
  rates: FxRates | null;
  currentPrice: number;
}) {
  const openTrade = trades.find((t) => t.isOpen);
  const openStats = openTrade ? computeCycleStats(openTrade.cycle) : null;
  const currency = currencyForRegion(region);
  const nativeIsSgd = currency === "SGD";

  let realizedNative = 0;
  let realizedBasis = 0;
  for (const trade of trades) {
    if (trade.isOpen) continue;
    const stats = computeCycleStats(trade.cycle);
    realizedNative += stats.realizedPLNative;
    // Summed by each cycle's own cost basis, so a small trade does not count as
    // much as a large one when the cycles are combined into one percentage.
    realizedBasis += stats.costBasisSold;
  }
  const realizedPct = realizedBasis > 0 ? realizedNative / realizedBasis : 0;
  const closedCount = trades.filter((t) => !t.isOpen).length;
  // The SGD line keeps its sign even though the headline percentage is the
  // coloured one: an unsigned amount under a negative return reads as a gain.
  const sgdOf = (native: number) =>
    rates
      ? `${native < 0 ? "-" : ""}${currencySymbol.SGD}${formatAmount(
          Math.abs(convertCurrency(native, region, "SGD", rates))
        )} in SGD`
      : `${native < 0 ? "-" : ""}${symbol}${formatAmount(Math.abs(native))}`;

  const unrealizedNative =
    openStats && openStats.avgBuyCost > 0
      ? (currentPrice - openStats.avgBuyCost) * openStats.remainingQty
      : 0;
  const unrealizedPct =
    openStats && openStats.avgBuyCost > 0
      ? (currentPrice - openStats.avgBuyCost) / openStats.avgBuyCost
      : 0;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-ink-700 px-5 py-4 lg:grid-cols-4">
      <SummaryStat
        label="Current price"
        value={
          <>
            {symbol}
            {formatAmount(currentPrice)}
          </>
        }
        hint={
          openTrade
            ? `Trade ${openTrade.tradeNumber} open${closedCount > 0 ? ` · ${closedCount} closed` : ""}`
            : `${closedCount} closed trade${closedCount === 1 ? "" : "s"}`
        }
      />

      {openStats && openTrade ? (
        <>
          <SummaryStat
            label="Avg cost (open)"
            value={
              <>
                {symbol}
                {formatAmount(openStats.avgBuyCost)}
              </>
            }
            hint={`${formatQty(openStats.remainingQty)} held`}
          />
          <SummaryStat
            label="Unrealised P/L"
            tone={plTone(unrealizedPct)}
            value={signedPct(unrealizedPct)}
            hint={sgdOf(unrealizedNative)}
          />
        </>
      ) : (
        <SummaryStat
          label="Position"
          value="Fully closed"
          hint="No shares held, so there is nothing unrealised"
        />
      )}

      <SummaryStat
        label="Realised P/L"
        tone={closedCount > 0 ? plTone(realizedPct) : ""}
        value={closedCount > 0 ? signedPct(realizedPct) : "—"}
        hint={closedCount > 0 ? sgdOf(realizedNative) : "No completed trade yet"}
      />
      {/* The native figure is only worth a line when it differs from SGD —
          repeating the same number twice is what the two-currency layout is
          meant to avoid, not double down on. */}
      {!nativeIsSgd && closedCount > 0 && (
        <p className="col-span-2 text-xs text-ink-500 lg:col-span-4">
          Amounts in {currency} are the trade currency; the SGD line converts at the
          current rate, so it is a present-day comparison rather than what the trade
          actually settled at.
        </p>
      )}
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

  // The headline is the first thing you should see in the section, so it rides
  // in the header rather than below a six-row table.
  const headlinePct = trade.isOpen ? unrealizedPLPct : stats.realizedPLPct;

  return (
    <section className="rounded-lg border border-ink-700">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-700 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium text-ink-100">
            Trade {trade.tradeNumber}
          </p>
          <span className="badge-accent">{trade.isOpen ? "open" : "closed"}</span>
          <p className="text-xs text-ink-300">Held {holdingPeriod}</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-xs text-ink-300">{trade.isOpen ? "Unrealised" : "Realised"}</p>
          <p className={`num text-lg font-semibold ${plTone(headlinePct)}`}>
            {signedPct(headlinePct)}
          </p>
        </div>
      </div>

      {/* Horizontal scroll only. The vertical scrolling belongs to the modal
          body: a scroll box inside a scroll box is where a wheel gesture goes
          to the wrong element, and it was the modal's previous structure. */}
      <div className="overflow-x-auto">
        <table className="ledger-table table-compact">
          <thead>
            {/* The narrow columns are pinned so the slack lands on the note,
                which is the only cell whose contents vary in width. Left to
                itself the table spreads six columns across 880px and the
                figures drift a hand-span apart. */}
            <tr>
              <th className="w-[6rem]">Date</th>
              <th className="w-[5rem]">Action</th>
              <th className="w-[4.5rem] text-right">Qty</th>
              <th className="w-[7rem] text-right">Price</th>
              <th className="w-[6.5rem] text-right">Running qty</th>
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
                    {note.note ?? <LedgerLine row={row} symbol={symbol} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-ink-700 px-4 py-3">
        {/* What the trade cost, what it brought in, and what that leaves. The
            two figures in the middle are not decoration: they are the two terms
            the Realised P/L is the difference of, so the return can be checked
            rather than taken on trust — proceeds minus cost basis sold is the
            number beside them, to the cent. Before this, the footer asserted a
            realised figure and gave you nothing to check it against. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Metric
            label="Avg buy cost"
            value={`${symbol}${formatAmount(stats.avgBuyCost)}`}
          />
          {stats.hasSells && (
            <Metric
              label="Avg sell cost"
              value={`${symbol}${formatAmount(stats.avgSellCost)}`}
              hint={`${formatQty(stats.soldQty)} sold`}
            />
          )}
          {stats.hasSells && (
            <Metric
              label="Cost basis sold"
              value={`${symbol}${formatAmount(stats.costBasisSold)}`}
            />
          )}
          {stats.hasSells && (
            <Metric label="Proceeds" value={`${symbol}${formatAmount(stats.proceeds)}`} />
          )}
          {stats.hasSells && (
            <Metric
              label="Realised P/L"
              value={<NativeMoney value={stats.realizedPLNative} symbol={symbol} showPlus />}
              hint={plHint(stats.realizedPLPct, stats.realizedPLNative, {
                region,
                rates,
                nativeIsSgd,
              })}
            />
          )}
          {trade.isOpen && (
            <Metric
              label="Unrealised P/L"
              value={<NativeMoney value={unrealizedPLNative} symbol={symbol} showPlus />}
              hint={plHint(unrealizedPLPct, unrealizedPLNative, { region, rates, nativeIsSgd })}
            />
          )}
        </div>

        {!nativeIsSgd && (stats.hasSells || trade.isOpen) && (
          <p className="mt-3 text-xs text-ink-500">
            Amounts in {currency} are the trade currency; the SGD line converts at the current
            rate, so it is a present-day comparison rather than what the trade settled at.
          </p>
        )}
      </div>
    </section>
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
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  // Focus the dialog itself on open, so Escape and the scroll keys reach it
  // without a click first. The close button is one Tab away.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Transaction history for ${companyName || ticker}`}
        tabIndex={-1}
        className="panel flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
          <div>
            <p className="text-xs text-ink-300">Transaction history</p>
            <p className="text-lg font-medium text-ink-100">{companyName || ticker}</p>
            <p className="num text-xs text-ink-300">
              {ticker} · <RegionFlag region={region} className="mr-0.5" />
              {region}
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

        {/* The one vertical scroller. Nothing inside it has its own `max-h`. */}
        <div className="overflow-y-auto">
          {error && <p className="p-5 text-sm text-loss">{error}</p>}
          {!error && !rows && <p className="p-5 text-sm text-ink-300">Loading…</p>}
          {!error && rows && rows.length === 0 && (
            <p className="p-5 text-sm text-ink-300">No transactions found for this position.</p>
          )}
          {!error && rows && rows.length > 0 && (
            <>
              <SummaryStrip
                trades={trades}
                symbol={symbol}
                region={region}
                rates={rates}
                currentPrice={currentPrice}
              />
              <div className="flex flex-col gap-4 p-5">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
