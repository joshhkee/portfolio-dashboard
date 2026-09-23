"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LedgerRow } from "@/lib/portfolio-engine";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatQty, formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";
import TickerName from "@/components/TickerName";
import { noteCell } from "@/lib/notes";
import LedgerLine from "@/components/LedgerLine";

export default function EditableTransactionRow({
  t,
  name = null,
}: {
  t: LedgerRow;
  name?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = new Date(t.date).toISOString().slice(0, 10);
  // The Note cell: what this row did to the position — derived from the ledger
  // on every render, never stored — with the owner's own words appended after
  // it. The derived part is unconditional, so a row carrying a DCA month or a
  // stop-loss level still shows its arithmetic instead of losing it to the
  // note. Reference-data notes (the instrument's name, hand-typed) are not
  // appended at all: the name is already rendered under the ticker. Hiding is
  // display only — the stored text comes back untouched in the edit row below.
  const cell = noteCell(t, currencySymbol[currencyForRegion(t.region)], t.notes, {
    ticker: t.ticker,
    name,
  });

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      date: form.get("date"),
      action: form.get("action"),
      ticker: form.get("ticker"),
      region: form.get("region"),
      qty: form.get("qty"),
      price: form.get("price"),
      notes: form.get("notes"),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/transactions/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save transaction");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this transaction? This can't be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/transactions/${t.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-ink-900/60">
        <td colSpan={11} className="px-3 py-3">
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Date</label>
              <input name="date" type="date" required defaultValue={dateStr} className="field w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Action</label>
              <select name="action" required defaultValue={t.action} className="field w-28">
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Ticker</label>
              <input name="ticker" required defaultValue={t.ticker} className="field w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Region</label>
              <select name="region" required defaultValue={t.region} className="field w-24">
                <option value="US">US</option>
                <option value="SG">SG</option>
                <option value="HK">HK</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Qty</label>
              <input
                name="qty"
                type="number"
                step="0.0001"
                min="0"
                required
                defaultValue={t.qty}
                className="field w-24"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Price</label>
              <input
                name="price"
                type="number"
                step="0.0001"
                min="0"
                required
                defaultValue={t.price}
                className="field w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Note</label>
              <input
                name="notes"
                defaultValue={t.notes ?? ""}
                className="field w-56"
                placeholder="Optional"
              />
              {/* Says where the text lands, because the ledger line is not in
                  this field and never was: it is derived, and whatever is
                  typed here is appended to it. That is what makes clearing the
                  field safe — nothing factual is lost by emptying it. */}
              <p className="max-w-xs text-xs text-ink-500">
                {cell.dca
                  ? `Marks this buy as a DCA — the ledger shows it as: ${cell.derived.text}`
                  : cell.appended === null && t.notes?.trim()
                    ? "Just the instrument's name — the ledger shows that from the ticker lookup, so this can be cleared."
                    : `Your own words, appended after the ledger line: ${cell.derived.text}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
            {error && <p className="w-full text-sm text-loss">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  const symbol = currencySymbol[currencyForRegion(t.region)];

  return (
    <tr className={t.runningQty < 0 ? "bg-loss/10" : undefined}>
      <td className="num text-ink-300">
        {formatShortDate(new Date(t.date))}
      </td>
      <td className={t.action === "Buy" ? "text-gain" : "text-loss"}>{t.action}</td>
      <td>
        <span className="num">{t.ticker}</span>
        {/* Company/fund name — previously the owner hand-typed this into
            the notes field on every row. */}
        <TickerName region={t.region} ticker={t.ticker} name={name} />
      </td>
      <td className="text-ink-300">{t.region}</td>
      <td className="num text-right">{formatQty(t.qty)}</td>
      <td className="num text-right">
        {symbol}
        {formatAmount(t.price)}
      </td>
      <td
        className={`num hidden text-right lg:table-cell ${
          t.runningQty < 0 ? "font-semibold text-loss" : ""
        }`}
      >
        {formatQty(t.runningQty)}
      </td>
      <td className="num text-right">
        {symbol}
        {formatAmount(t.runningAvgCost)}
      </td>
      {/* Matches the header's visibility: `Qty × Price`, so it is the column
          that gives up its width first when the window is narrow. */}
      <td className="num hidden text-right min-[1400px]:table-cell">
        {symbol}
        {formatAmount(t.transactionValue)}
      </td>
      {/* One line, facts first, the owner's words after. The cell is muted
          because the derived part is generated; `LedgerLine` brightens the
          note inside it, so which half you are reading is legible without
          parsing the text.

          The cap is what this column costs the table: `Date` through `Txn
          value` are all content- or header-sized, so every pixel of the note
          column comes out of the whole row's width, and this table has to fit a
          desktop window without sideways scrolling. Long notes therefore
          truncate with the full text one hover away — and because the note is
          LAST, it is the note that gets cut, never the arithmetic. */}
      <td className="max-w-[16rem] truncate text-left text-ink-500" title={cell.text}>
        <LedgerLine parts={cell.derived.parts} note={cell.appended} />
      </td>
      <td>
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-ink-300 hover:text-accent"
            title="Edit transaction"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="text-xs text-ink-300 hover:text-loss disabled:opacity-50"
            title="Delete transaction"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
