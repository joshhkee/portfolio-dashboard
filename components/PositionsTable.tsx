"use client";

import { useMemo, useState } from "react";
import { Percent, PlainPercent, NativeMoney, formatAmount } from "@/components/SignedNumber";
import { TriangleAlert } from "lucide-react";
import { currencySymbol, currencyForRegion, type Currency } from "@/lib/fx";
import { formatHoldingPeriod } from "@/lib/dates";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";
import TransactionHistoryModal from "@/components/TransactionHistoryModal";
import TickerName from "@/components/TickerName";

export interface PositionRow {
  region: string;
  ticker: string;
  // Descriptive reference data from the ticker-meta cache (see
  // lib/ticker-meta.ts) — display only, never affects the numbers.
  name: string | null;
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
  heldSince: Date | null;
}

const REGION_LABEL: Record<Currency, string> = { USD: "US", SGD: "SG", HKD: "HK" };

const GETTERS: Record<string, (r: PositionRow) => number | string> = {
  region: (r) => r.region,
  ticker: (r) => r.ticker,
  qty: (r) => r.qty,
  avgCost: (r) => r.avgCost,
  heldSince: (r) => r.heldSince?.getTime() ?? 0,
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
      <div className="flex gap-10">
        <div>
          <p className="text-sm text-ink-300">Total holdings ({displayCurrency})</p>
          <p className="num mt-1 text-3xl font-medium">
            {displaySymbol}
            {formatAmount(totalValueConverted)}
          </p>
        </div>
        <div>
          <p className="text-sm text-ink-300">Unrealized P/L ({displayCurrency})</p>
          <p className="num mt-1 text-3xl font-medium">
            <NativeMoney value={totalPLConverted} symbol={displaySymbol} showPlus />
          </p>
        </div>
      </div>
      {mixedCurrencies && (
        <p className="-mt-4 text-xs text-ink-300">
          Per-row figures below are in each market&apos;s native currency; totals above and
          Portfolio % are converted to {displayCurrency} at the current rate so regions can be
          compared.
        </p>
      )}
      {anyPriceUnavailable && (
        <p className="-mt-4 text-xs text-ink-300">
          One or more tickers below have no live quote available right now (common for HK
          listings) — those rows show total holdings at cost basis and their unrealized P/L as
          N/A rather than a possibly-wrong number. The totals above treat those rows as
          contributing $0 unrealized P/L, so they may understate the true total.
        </p>
      )}

      <div className="flex justify-end">
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
                active={sortKey === "qty"}
                direction={sortDir}
                onClick={() => toggleSort("qty")}
                          align="right"
              />
              <SortableTh
                label="Avg cost"
                active={sortKey === "avgCost"}
                direction={sortDir}
                onClick={() => toggleSort("avgCost")}
                          align="right"
              />
              <SortableTh
                label="Held"
                active={sortKey === "heldSince"}
                direction={sortDir}
                onClick={() => toggleSort("heldSince")}
                align="right"
              />
              <SortableTh
                label="Current price"
                active={sortKey === "currentPrice"}
                direction={sortDir}
                onClick={() => toggleSort("currentPrice")}
                          align="right"
              />
              <SortableTh
                label="Total holdings"
                active={sortKey === "totalHoldings"}
                direction={sortDir}
                onClick={() => toggleSort("totalHoldings")}
                          align="right"
              />
              <SortableTh
                label={`${REGION_LABEL[displayCurrency]} Portfolio %`}
                active={sortKey === "portfolioPct"}
                direction={sortDir}
                onClick={() => toggleSort("portfolioPct")}
                          align="right"
              />
              <SortableTh
                label="Unrealized P/L (%)"
                active={sortKey === "unrealizedPLPct"}
                direction={sortDir}
                onClick={() => toggleSort("unrealizedPLPct")}
                          align="right"
              />
              <SortableTh
                label="Unrealized P/L"
                active={sortKey === "unrealizedPL"}
                direction={sortDir}
                onClick={() => toggleSort("unrealizedPL")}
                          align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const symbol = currencySymbol[currencyForRegion(r.region)];
              return (
                <tr
                  key={`${r.region}-${r.ticker}`}
                  onClick={() => setSelected({ region: r.region, ticker: r.ticker, currentPrice: r.currentPrice })}
                  className="cursor-pointer hover:bg-ink-900/60"
                  title="View transaction history"
                >
                  <td className="text-ink-300">{r.region}</td>
                  <td>
                    <span className="num">
                      {r.ticker}
                      {r.priceUnavailable && (
                        <TriangleAlert
                          size={12}
                          className="ml-1 inline text-ink-500"
                          aria-label="No live quote available for this ticker — price/P&L shown may be stale"
                        />
                      )}
                    </span>
                    {/* The company/fund name, so the ledger is readable
                        without hand-typing it into a note. */}
                    <TickerName region={r.region} ticker={r.ticker} name={r.name} />
                  </td>
                  <td className="num text-right">{r.qty}</td>
                  <td className="num text-right">
                    {symbol}
                    {formatAmount(r.avgCost)}
                  </td>
                  <td className="text-right text-ink-300">
                    {r.heldSince ? formatHoldingPeriod(r.heldSince) : "—"}
                  </td>
                  <td className="num text-right">
                    {r.priceUnavailable ? (
                      <span className="text-ink-500" title="No live quote available">
                        —
                      </span>
                    ) : (
                      <>
                        {symbol}
                        {formatAmount(r.currentPrice)}
                      </>
                    )}
                  </td>
                  <td className="num text-right">
                    {symbol}
                    {formatAmount(r.totalHoldings)}
                  </td>
                  <td className="text-right">
                    <PlainPercent value={r.portfolioPct} />
                  </td>
                  <td className="text-right">
                    {r.priceUnavailable ? (
                      <span className="text-ink-500" title="No live quote — can't compute unrealized P/L">
                        N/A
                      </span>
                    ) : (
                      <Percent value={r.unrealizedPLPct} />
                    )}
                  </td>
                  <td className="text-right">
                    {r.priceUnavailable ? (
                      <span className="text-ink-500">N/A</span>
                    ) : (
                      <NativeMoney value={r.unrealizedPL} symbol={symbol} />
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-ink-300">
                  {rows.length === 0
                    ? "No holdings in this region right now."
                    : "No holdings match your search."}
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
