"use client";

import { Fragment, useEffect, useState } from "react";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatShortDate } from "@/lib/dates";
import { formatQty } from "@/components/SignedNumber";

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

export default function TransactionHistoryModal({
  region,
  ticker,
  onClose,
}: {
  region: string;
  ticker: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions?region=${encodeURIComponent(region)}&ticker=${encodeURIComponent(ticker)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load transaction history");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setRows(data);
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

  const { closedCycles, openCycle } = rows ? splitIntoCycles(rows) : { closedCycles: [], openCycle: [] };
  const symbol = currencySymbol[currencyForRegion(region)];

  function renderRow(row: HistoryRow) {
    return (
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
    );
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
          {!error && rows && rows.length > 0 && (
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
                {closedCycles.map((cycle, i) => (
                  <Fragment key={i}>
                    {cycle.map(renderRow)}
                    <tr>
                      <td colSpan={6} className="border-b border-ink-800 bg-ink-900/60 py-2 text-xs text-ink-300">
                        — Position closed here (fully sold) — reopened below —
                      </td>
                    </tr>
                  </Fragment>
                ))}
                {openCycle.map(renderRow)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
