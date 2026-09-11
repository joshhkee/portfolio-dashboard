"use client";

import { useMemo, useState } from "react";
import { Money, Percent, PlainPercent, NativeMoney } from "@/components/SignedNumber";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";

export interface PositionRow {
  region: string;
  ticker: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  totalHoldings: number;
  totalHoldingsUSD: number;
  unrealizedPL: number;
  unrealizedPLUSD: number;
  unrealizedPLPct: number;
  portfolioPct: number;
}

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

export default function PositionsTable({ rows }: { rows: PositionRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));
  }, [rows, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "ticker", "asc");

  // Mixed-currency pages (SG + HK together) must total in USD; a
  // single-currency page (US) will show the same number either way.
  const totalValueUSD = rows.reduce((sum, r) => sum + r.totalHoldingsUSD, 0);
  const totalPLUSD = rows.reduce((sum, r) => sum + r.unrealizedPLUSD, 0);
  const mixedCurrencies = new Set(rows.map((r) => r.region)).size > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-10">
        <div>
          <p className="text-sm text-ink-300">Total holdings (USD)</p>
          <p className="num mt-1 text-3xl font-medium">${totalValueUSD.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Unrealized P/L (USD)</p>
          <p className="num mt-1 text-3xl font-medium">
            <Money value={totalPLUSD} />
          </p>
        </div>
      </div>
      {mixedCurrencies && (
        <p className="-mt-4 text-xs text-ink-300">
          Per-row figures below are in each market&apos;s native currency; totals above and
          Portfolio % are converted to USD at the current rate so SG and HK can be compared.
        </p>
      )}

      <div className="flex justify-end">
        <SearchBox value={search} onChange={setSearch} placeholder="Search ticker or region…" />
      </div>

      <div className="overflow-x-auto">
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
              active={sortKey === "qty"}
              direction={sortDir}
              onClick={() => toggleSort("qty")}
            />
            <SortableTh
              label="Avg cost"
              active={sortKey === "avgCost"}
              direction={sortDir}
              onClick={() => toggleSort("avgCost")}
            />
            <SortableTh
              label="Current price"
              active={sortKey === "currentPrice"}
              direction={sortDir}
              onClick={() => toggleSort("currentPrice")}
            />
            <SortableTh
              label="Total holdings"
              active={sortKey === "totalHoldings"}
              direction={sortDir}
              onClick={() => toggleSort("totalHoldings")}
            />
            <SortableTh
              label="Portfolio %"
              active={sortKey === "portfolioPct"}
              direction={sortDir}
              onClick={() => toggleSort("portfolioPct")}
            />
            <SortableTh
              label="Unrealized P/L (%)"
              active={sortKey === "unrealizedPLPct"}
              direction={sortDir}
              onClick={() => toggleSort("unrealizedPLPct")}
            />
            <SortableTh
              label="Unrealized P/L"
              active={sortKey === "unrealizedPL"}
              direction={sortDir}
              onClick={() => toggleSort("unrealizedPL")}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const symbol = currencySymbol[currencyForRegion(r.region)];
            return (
              <tr key={`${r.region}-${r.ticker}`}>
                <td className="text-ink-300">{r.region}</td>
                <td className="num">{r.ticker}</td>
                <td className="num">{r.qty}</td>
                <td className="num">
                  {symbol}
                  {r.avgCost.toFixed(2)}
                </td>
                <td className="num">
                  {symbol}
                  {r.currentPrice.toFixed(2)}
                </td>
                <td className="num">
                  {symbol}
                  {r.totalHoldings.toFixed(2)}
                </td>
                <td>
                  <PlainPercent value={r.portfolioPct} />
                </td>
                <td>
                  <Percent value={r.unrealizedPLPct} />
                </td>
                <td>
                  <NativeMoney value={r.unrealizedPL} symbol={symbol} />
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="py-6 text-center text-ink-300">
                {rows.length === 0 ? "No open positions in this region right now." : "No positions match your search."}
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}
