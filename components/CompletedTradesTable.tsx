"use client";

import { useMemo, useState } from "react";
import { NativeMoney, Percent } from "@/components/SignedNumber";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";

export interface CompletedTradeRow {
  id: number;
  sellDate: Date;
  region: string;
  ticker: string;
  qtySold: number;
  avgCost: number;
  sellPrice: number;
  realizedPL: number;
  realizedPLSGD: number;
  returnPct: number;
  notes?: string | null;
}

const GETTERS: Record<string, (t: CompletedTradeRow) => number | string> = {
  sellDate: (t) => new Date(t.sellDate).getTime(),
  region: (t) => t.region,
  ticker: (t) => t.ticker,
  qtySold: (t) => t.qtySold,
  avgCost: (t) => t.avgCost,
  sellPrice: (t) => t.sellPrice,
  realizedPL: (t) => t.realizedPL,
  realizedPLSGD: (t) => t.realizedPLSGD,
  returnPct: (t) => t.returnPct,
};

export default function CompletedTradesTable({ trades }: { trades: CompletedTradeRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter(
      (t) =>
        t.ticker.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
    );
  }, [trades, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "sellDate", "desc");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SearchBox value={search} onChange={setSearch} placeholder="Search ticker, region, or notes…" />
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
        <thead>
          <tr>
            <SortableTh label="Sell date" active={sortKey === "sellDate"} direction={sortDir} onClick={() => toggleSort("sellDate")} />
            <SortableTh label="Region" active={sortKey === "region"} direction={sortDir} onClick={() => toggleSort("region")} />
            <SortableTh label="Ticker" active={sortKey === "ticker"} direction={sortDir} onClick={() => toggleSort("ticker")} />
            <SortableTh label="Qty sold" active={sortKey === "qtySold"} direction={sortDir} onClick={() => toggleSort("qtySold")} />
            <SortableTh label="Avg cost" active={sortKey === "avgCost"} direction={sortDir} onClick={() => toggleSort("avgCost")} />
            <SortableTh label="Sell price" active={sortKey === "sellPrice"} direction={sortDir} onClick={() => toggleSort("sellPrice")} />
            <SortableTh
              label="Realized P/L (native)"
              active={sortKey === "realizedPL"}
              direction={sortDir}
              onClick={() => toggleSort("realizedPL")}
            />
            <SortableTh
              label="Realized P/L (SGD)"
              active={sortKey === "realizedPLSGD"}
              direction={sortDir}
              onClick={() => toggleSort("realizedPLSGD")}
            />
            <SortableTh label="Return %" active={sortKey === "returnPct"} direction={sortDir} onClick={() => toggleSort("returnPct")} />
            <th className="text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const symbol = currencySymbol[currencyForRegion(t.region)];
            return (
              <tr key={t.id}>
                <td className="num text-ink-300">
                  {formatShortDate(new Date(t.sellDate))}
                </td>
                <td className="text-ink-300">{t.region}</td>
                <td className="num">{t.ticker}</td>
                <td className="num">{t.qtySold}</td>
                <td className="num">
                  {symbol}
                  {t.avgCost.toFixed(2)}
                </td>
                <td className="num">
                  {symbol}
                  {t.sellPrice.toFixed(2)}
                </td>
                <td className="num text-ink-300">
                  {t.realizedPL < 0 ? "-" : t.realizedPL > 0 ? "+" : ""}
                  {symbol}
                  {Math.abs(t.realizedPL).toFixed(2)}
                </td>
                <td>
                  <NativeMoney value={t.realizedPLSGD} symbol={currencySymbol.SGD} showPlus />
                </td>
                <td>
                  <Percent value={t.returnPct} />
                </td>
                <td className="max-w-xs truncate text-left text-ink-300" title={t.notes ?? undefined}>
                  {t.notes}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="py-6 text-center text-ink-300">
                {trades.length === 0 ? "No closed trades yet." : "No trades match your search."}
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}
