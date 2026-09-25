"use client";

import { useEffect, useMemo } from "react";
import { NativeMoney, Percent, formatAmount } from "@/components/SignedNumber";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import SortableTh from "@/components/SortableTh";
import { useTableSearch } from "@/components/TableSearch";
import { useSortable } from "@/lib/use-sortable";
import TickerName from "@/components/TickerName";

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

export default function CompletedTradesTable({
  trades,
  names = {},
}: {
  trades: CompletedTradeRow[];
  /** Compound "REGION::TICKER" -> display name, from the ticker-meta cache. */
  names?: Record<string, string>;
}) {
  // Same contract as the ledger: the filter lives in the page bar (see
  // TableSearch) and the count of what survived it is reported back, so the
  // figure in the bar and the rows in the table cannot disagree.
  const { query, setShown } = useTableSearch();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter(
      (t) =>
        t.ticker.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
    );
  }, [trades, query]);

  useEffect(() => {
    setShown(filtered.length);
  }, [filtered.length, setShown]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "sellDate", "desc");

  return (
    // The table's own box: a direct child of `.screen`, so `lg:flex-1` here means
    // it takes whatever height the page has left and scrolls its own rows. The
    // row that used to sit above it ("Newest first" plus the filter) is gone —
    // the filter is in the page bar, and that height went to the rows.
    <div className="table-scroll">
        <table className="ledger-table">
        <thead>
          <tr>
            <SortableTh label="Sell date" active={sortKey === "sellDate"} direction={sortDir} onClick={() => toggleSort("sellDate")} />
            <SortableTh label="Region" active={sortKey === "region"} direction={sortDir} onClick={() => toggleSort("region")} />
            <SortableTh label="Ticker" active={sortKey === "ticker"} direction={sortDir} onClick={() => toggleSort("ticker")} />
            <SortableTh label="Qty sold" active={sortKey === "qtySold"} direction={sortDir} onClick={() => toggleSort("qtySold")} align="right" />
            <SortableTh label="Avg cost" active={sortKey === "avgCost"} direction={sortDir} onClick={() => toggleSort("avgCost")} align="right" />
            <SortableTh label="Sell price" active={sortKey === "sellPrice"} direction={sortDir} onClick={() => toggleSort("sellPrice")} align="right" />
            <SortableTh
              label="Realized P/L (native)"
              active={sortKey === "realizedPL"}
              direction={sortDir}
              onClick={() => toggleSort("realizedPL")}
              align="right"
            />
            <SortableTh
              label="Realized P/L (SGD)"
              active={sortKey === "realizedPLSGD"}
              direction={sortDir}
              onClick={() => toggleSort("realizedPLSGD")}
              align="right"
            />
            <SortableTh label="Return %" active={sortKey === "returnPct"} direction={sortDir} onClick={() => toggleSort("returnPct")} align="right" />
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
                <td>
                  <span className="num">{t.ticker}</span>
                  <TickerName
                    region={t.region}
                    ticker={t.ticker}
                    name={names[`${t.region}::${t.ticker}`] ?? null}
                  />
                </td>
                <td className="num text-right">{t.qtySold}</td>
                <td className="num text-right">
                  {symbol}
                  {formatAmount(t.avgCost)}
                </td>
                <td className="num text-right">
                  {symbol}
                  {formatAmount(t.sellPrice)}
                </td>
                <td className="num text-right text-ink-300">
                  {t.realizedPL < 0 ? "-" : t.realizedPL > 0 ? "+" : ""}
                  {symbol}
                  {formatAmount(Math.abs(t.realizedPL))}
                </td>
                <td className="text-right">
                  <NativeMoney value={t.realizedPLSGD} symbol={currencySymbol.SGD} showPlus />
                </td>
                <td className="text-right">
                  <Percent value={t.returnPct} />
                </td>
                <td className="max-w-[11rem] truncate text-left text-ink-300" title={t.notes ?? undefined}>
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
  );
}
