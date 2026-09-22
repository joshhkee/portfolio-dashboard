"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Percent, PlainPercent, NativeMoney, formatAmount } from "@/components/SignedNumber";
import { TriangleAlert } from "lucide-react";
import { currencySymbol, currencyForRegion, type Currency } from "@/lib/fx";
import { priceKey } from "@/lib/prices";
import { formatHoldingPeriod } from "@/lib/dates";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";
import TransactionHistoryModal from "@/components/TransactionHistoryModal";
import TickerName from "@/components/TickerName";
import Sparkline from "@/components/Sparkline";

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

  // The command palette navigates here with ?ticker=… to "jump to" a holding,
  // so this row is highlighted and scrolled into view on arrival.
  const searchParams = useSearchParams();
  const highlightTicker = searchParams.get("ticker");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  // One batched request for every row's 30-day trend, rather than a request
  // per row — see app/api/sparklines/route.ts for why that matters. Tickers
  // without usable history simply stay absent, and the cell renders a dash
  // instead of an invented flat line.
  const [spark, setSpark] = useState<Record<string, number[]>>({});
  // priceKey(), not a hand-built "region:ticker": the response is keyed by
  // priceKey and one format in the app is one format that cannot drift out of
  // step with the parser again (see lib/sparklines.ts).
  const sparkKeys = useMemo(
    () => rows.map((r) => priceKey(r.region, r.ticker)).join(","),
    [rows]
  );

  useEffect(() => {
    if (!sparkKeys) return;
    let cancelled = false;
    fetch(`/api/sparklines?keys=${encodeURIComponent(sparkKeys)}`)
      .then((res) => (res.ok ? res.json() : { series: {} }))
      .then((data) => {
        if (!cancelled) setSpark(data.series ?? {});
      })
      .catch(() => {
        if (!cancelled) setSpark({});
      });
    return () => {
      cancelled = true;
    };
  }, [sparkKeys]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.ticker.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));
  }, [rows, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "portfolioPct", "desc");

  // Declared after useSortable because it depends on `sorted` — the ref only
  // exists once the matching row has rendered.
  useEffect(() => {
    if (!highlightTicker) return;
    const node = highlightRef.current;
    if (!node) return;
    // Respect a reduced-motion preference: the jump still happens, it just
    // doesn't animate.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [highlightTicker, sorted.length]);

  const displaySymbol = currencySymbol[displayCurrency];

  // Mixed-currency pages must total in one currency; a single-currency
  // page will show the same number either way once converted.
  const totalValueConverted = rows.reduce((sum, r) => sum + r.totalHoldingsConverted, 0);
  const totalPLConverted = rows.reduce((sum, r) => sum + r.unrealizedPLConverted, 0);
  const mixedCurrencies = new Set(rows.map((r) => r.region)).size > 1;
  const anyPriceUnavailable = rows.some((r) => r.priceUnavailable);

  return (
    <div className="flex flex-col gap-6">
      <div className="stat-row">
        <div>
          <p className="stat-label">Total holdings ({displayCurrency})</p>
          <p className="stat-value">
            {displaySymbol}
            {formatAmount(totalValueConverted)}
          </p>
        </div>
        <div>
          <p className="stat-label">Unrealized P/L ({displayCurrency})</p>
          <p className="stat-value">
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
              {/* The three columns hidden below `lg` (`Held`, `30d`,
                  `Portfolio %`) are the ones whose value is either decorative
                  or derivable from the rest of the row — a holding period, a
                  trend line, and a share of a total the row's own neighbours
                  already imply. Everything you cannot recompute from the row
                  stays visible at every width. */}
              <SortableTh
                label="Held"
                active={sortKey === "heldSince"}
                direction={sortDir}
                onClick={() => toggleSort("heldSince")}
                align="right"
                className="hidden lg:table-cell"
              />
              <SortableTh
                label="Current price"
                active={sortKey === "currentPrice"}
                direction={sortDir}
                onClick={() => toggleSort("currentPrice")}
                          align="right"
              />
              {/* Not sortable: a trend line has no single ordering key that
                  would mean anything next to the numeric columns. */}
              <th className="hidden text-right lg:table-cell" title="Price trend over the last 30 days">
                30d
              </th>
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
                className="hidden lg:table-cell"
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
              // Looked up by the compound "REGION::TICKER" key the API returns
              // (see priceKey), which is also the form the request is made in
              // — one format in and out.
              const trend = spark[priceKey(r.region, r.ticker)];
              const isHit =
                highlightTicker !== null &&
                r.ticker.toLowerCase() === highlightTicker.toLowerCase();
              return (
                <tr
                  key={`${r.region}-${r.ticker}`}
                  ref={isHit ? highlightRef : undefined}
                  onClick={() => setSelected({ region: r.region, ticker: r.ticker, currentPrice: r.currentPrice })}
                  className={`cursor-pointer hover:bg-ink-900/60 ${
                    isHit ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : ""
                  }`}
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
                  <td className="hidden text-right text-ink-300 lg:table-cell">
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
                  <td className="hidden text-right lg:table-cell">
                    {trend ? <Sparkline values={trend} /> : <span className="text-ink-500">—</span>}
                  </td>
                  <td className="num text-right">
                    {symbol}
                    {formatAmount(r.totalHoldings)}
                  </td>
                  <td className="hidden text-right lg:table-cell">
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
                <td colSpan={11} className="py-6 text-center text-ink-300">
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
