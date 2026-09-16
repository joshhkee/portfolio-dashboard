"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import { Percent, PlainPercent, NativeMoney, formatAmount } from "@/components/SignedNumber";
import { currencySymbol, currencyForRegion, type Currency } from "@/lib/fx";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";
import TransactionHistoryModal from "@/components/TransactionHistoryModal";

export interface PositionRow {
  region: string;
  ticker: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  totalHoldings: number;
  totalHoldingsConverted: number;
  unrealizedPL: number;
  unrealizedPLConverted: number;
  unrealizedPLPct: number;
  portfolioPct: number;
  priceUnavailable: boolean;
}

const REGION_LABEL: Record<Currency, string> = { USD: "US", SGD: "SG", HKD: "HK" };

const GETTERS: Record<string, (r: PositionRow) => number | string> = {
  region: (r) => r.region,
  ticker: (r) => r.ticker,
  qty: (r) => r.qty,
  avgCost: (r) => r.avgCost,
  currentPrice: (r) => r.currentPrice,
  totalHoldings: (r) => r.totalHoldings,
  portfolioPct: (r) => r.portfolioPct,
  unrealizedPLPct: (r) => r.unrealizedPLPct,
  unrealizedPL: (r) => r.unrealizedPL,
};

export default function PositionsTable({
  rows,
  displayCurrency = "USD",
}: {
  rows: PositionRow[];
  displayCurrency?: Currency;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ region: string; ticker: string; currentPrice: number } | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));
  }, [rows, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "portfolioPct", "desc");

  const displaySymbol = currencySymbol[displayCurrency];

  // Mixed-currency pages must total in one currency; a single-currency
  // page will show the same number either way once converted.
  const totalValueConverted = rows.reduce((sum, r) => sum + r.totalHoldingsConverted, 0);
  const totalPLConverted = rows.reduce((sum, r) => sum + r.unrealizedPLConverted, 0);
  const mixedCurrencies = new Set(rows.map((r) => r.region)).size > 1;
  const anyPriceUnavailable = rows.some((r) => r.priceUnavailable);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface px-6 py-5">
          <p className="label">Total holdings ({displayCurrency})</p>
          <p className="num mt-2 text-3xl font-medium tracking-tight text-accent">
            {displaySymbol}
            {formatAmount(totalValueConverted)}
          </p>
        </div>
        <div className="bg-surface px-6 py-5">
          <p className="label">Unrealized P/L ({displayCurrency})</p>
          <p className="mt-2 text-3xl font-medium tracking-tight">
            <NativeMoney value={totalPLConverted} symbol={displaySymbol} showPlus />
          </p>
        </div>
      </div>

      {mixedCurrencies && (
        <p className="flex items-start gap-2 text-xs text-fg-subtle">
          <Info size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
          Per-row figures below are in each market&apos;s native currency; totals above and
          Portfolio % are converted to {displayCurrency} at the current rate so regions can be
          compared.
        </p>
      )}

      {anyPriceUnavailable && (
        <p className="flex items-start gap-2.5 rounded-md border border-line bg-negative-wash/60 px-3.5 py-3 text-xs text-fg-muted">
          <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-negative" aria-hidden />
          <span>
            One or more tickers below have no live quote available right now (common for HK
            listings) — those rows show total holdings at cost basis and their unrealized P/L as
            N/A rather than a possibly-wrong number. The totals above treat those rows as
            contributing {displayCurrency} 0 unrealized P/L, so they may understate the true total.
          </span>
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="label">
          {filtered.length} {filtered.length === 1 ? "position" : "positions"}
        </p>
        <SearchBox value={search} onChange={setSearch} placeholder="Search ticker or region…" />
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <SortableTh
                label="Region"
                active={sortKey === "region"}
                direction={sortDir}
                onClick={() => toggleSort("region")}
              />
              <SortableTh
                label="Ticker"
                active={sortKey === "ticker"}
                direction={sortDir}
                onClick={() => toggleSort("ticker")}
              />
              <SortableTh
                label="Qty"
                align="right"
                active={sortKey === "qty"}
                direction={sortDir}
                onClick={() => toggleSort("qty")}
              />
              <SortableTh
                label="Avg cost"
                align="right"
                active={sortKey === "avgCost"}
                direction={sortDir}
                onClick={() => toggleSort("avgCost")}
              />
              <SortableTh
                label="Current price"
                align="right"
                active={sortKey === "currentPrice"}
                direction={sortDir}
                onClick={() => toggleSort("currentPrice")}
              />
              <SortableTh
                label="Total holdings"
                align="right"
                active={sortKey === "totalHoldings"}
                direction={sortDir}
                onClick={() => toggleSort("totalHoldings")}
              />
              <SortableTh
                label={`${REGION_LABEL[displayCurrency]} Portfolio %`}
                align="right"
                active={sortKey === "portfolioPct"}
                direction={sortDir}
                onClick={() => toggleSort("portfolioPct")}
              />
              <SortableTh
                label="Unrealized P/L (%)"
                align="right"
                active={sortKey === "unrealizedPLPct"}
                direction={sortDir}
                onClick={() => toggleSort("unrealizedPLPct")}
              />
              <SortableTh
                label="Unrealized P/L"
                align="right"
                active={sortKey === "unrealizedPL"}
                direction={sortDir}
                onClick={() => toggleSort("unrealizedPL")}
              />
              <th className="w-10 text-right">
                <span className="sr-only">History</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const symbol = currencySymbol[currencyForRegion(r.region)];
              return (
                <tr
                  key={`${r.region}-${r.ticker}`}
                  onClick={() => setSelected({ region: r.region, ticker: r.ticker, currentPrice: r.currentPrice })}
                  className="group cursor-pointer"
                  title="View transaction history"
                >
                  <td>{r.region}</td>
                  <td className="num cell-strong">
                    <span className="inline-flex items-center gap-1.5">
                      {r.ticker}
                      {r.priceUnavailable && (
                        <AlertTriangle
                          size={12}
                          strokeWidth={1.5}
                          className="text-negative/80"
                          aria-label="No live quote available for this ticker — price and P/L shown may be stale"
                        />
                      )}
                    </span>
                  </td>
                  <td className="num text-right cell-strong">{r.qty}</td>
                  <td className="num text-right">
                    {symbol}
                    {formatAmount(r.avgCost)}
                  </td>
                  <td className="num text-right">
                    {r.priceUnavailable ? (
                      <span className="text-fg-subtle" title="No live quote available">
                        —
                      </span>
                    ) : (
                      <>
                        {symbol}
                        {formatAmount(r.currentPrice)}
                      </>
                    )}
                  </td>
                  <td className="num text-right cell-strong">
                    {symbol}
                    {formatAmount(r.totalHoldings)}
                  </td>
                  <td className="text-right">
                    <PlainPercent value={r.portfolioPct} />
                  </td>
                  <td className="text-right">
                    {r.priceUnavailable ? (
                      <span className="num text-fg-subtle" title="No live quote — can't compute unrealized P/L">
                        N/A
                      </span>
                    ) : (
                      <Percent value={r.unrealizedPLPct} />
                    )}
                  </td>
                  <td className="text-right">
                    {r.priceUnavailable ? (
                      <span className="num text-fg-subtle">N/A</span>
                    ) : (
                      <NativeMoney value={r.unrealizedPL} symbol={symbol} />
                    )}
                  </td>
                  <td className="text-right">
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden
                      className="ml-auto text-fg-subtle/50 transition group-hover:text-accent"
                    />
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center">
                  {rows.length === 0
                    ? "No open positions in this region right now."
                    : "No positions match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TransactionHistoryModal
          region={selected.region}
          ticker={selected.ticker}
          currentPrice={selected.currentPrice}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
