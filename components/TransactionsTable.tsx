"use client";

import { useMemo, useState } from "react";
import type { LedgerRow } from "@/lib/portfolio-engine";
import EditableTransactionRow from "@/components/EditableTransactionRow";
import SortableTh from "@/components/SortableTh";
import SearchBox from "@/components/SearchBox";
import { useSortable } from "@/lib/use-sortable";

const GETTERS: Record<string, (t: LedgerRow) => number | string> = {
  date: (t) => new Date(t.date).getTime(),
  action: (t) => t.action,
  ticker: (t) => t.ticker,
  region: (t) => t.region,
  qty: (t) => t.qty,
  price: (t) => t.price,
  runningQty: (t) => t.runningQty,
  runningAvgCost: (t) => t.runningAvgCost,
  transactionValue: (t) => t.transactionValue,
};

export default function TransactionsTable({
  ledger,
  names = {},
}: {
  ledger: LedgerRow[];
  /** Compound "REGION::TICKER" -> display name, from the ticker-meta cache. */
  names?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ledger;
    return ledger.filter(
      (t) =>
        t.ticker.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
    );
  }, [ledger, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(filtered, GETTERS, "date", "desc");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SearchBox value={search} onChange={setSearch} placeholder="Search ticker, region, or notes…" />
      </div>

      <div className="table-scroll">
        <table className="ledger-table">
        <thead>
          <tr>
            <SortableTh label="Date" active={sortKey === "date"} direction={sortDir} onClick={() => toggleSort("date")} />
            <SortableTh label="Action" active={sortKey === "action"} direction={sortDir} onClick={() => toggleSort("action")} />
            <SortableTh label="Ticker" active={sortKey === "ticker"} direction={sortDir} onClick={() => toggleSort("ticker")} />
            <SortableTh label="Region" active={sortKey === "region"} direction={sortDir} onClick={() => toggleSort("region")} />
            <SortableTh label="Qty" active={sortKey === "qty"} direction={sortDir} onClick={() => toggleSort("qty")} align="right" />
            <SortableTh label="Price" active={sortKey === "price"} direction={sortDir} onClick={() => toggleSort("price")} align="right" />
            {/* Hidden below `lg`: recomputable from columns that stay (running
                qty from the qty/action history), so a narrow window loses
                screen width rather than information. */}
            <SortableTh
              label="Running qty"
              active={sortKey === "runningQty"}
              direction={sortDir}
              onClick={() => toggleSort("runningQty")}
              align="right"
              className="hidden lg:table-cell"
            />
            <SortableTh
              label="Avg cost"
              title="Average cost basis per share after this transaction."
              active={sortKey === "runningAvgCost"}
              direction={sortDir}
              onClick={() => toggleSort("runningAvgCost")}
              align="right"
            />
            {/* The one column that is pure arithmetic on two others on the same
                row — `Qty × Price` — so it is what pays for the Note column's
                width. `min-[1400px]` is not a breakpoint for its own sake: it
                is the window width at which the table (with this column) still
                fits without sideways scrolling, measured. Narrower, and the
                note keeps its room and this value stays one multiplication
                away; wider, and both are shown. */}
            <SortableTh
              label="Txn value"
              active={sortKey === "transactionValue"}
              direction={sortDir}
              onClick={() => toggleSort("transactionValue")}
              align="right"
              className="hidden min-[1400px]:table-cell"
            />
            {/* Two halves in one cell: what the ledger derived from the row,
                then your own words. The tooltip says so once rather than per
                row, because the relationship is the surprising part — a note
                is added to the derived line, not written in place of it. */}
            <th
              className="text-left"
              title="What the ledger derived from this row, then any note you wrote — appended after it. A note never replaces the derived facts."
            >
              Note
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <EditableTransactionRow
              key={t.id}
              t={t}
              name={names[`${t.region}::${t.ticker}`] ?? null}
            />
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={11} className="py-6 text-center text-ink-300">
                {ledger.length === 0
                  ? "No transactions yet — log the first one above."
                  : "No transactions match your search."}
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}
