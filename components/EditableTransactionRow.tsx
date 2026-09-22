"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LedgerRow } from "@/lib/portfolio-engine";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatQty, formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";
import TickerName from "@/components/TickerName";
import { classifyNote, ledgerSummary } from "@/lib/notes";
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
  // What this row did to the position — derived from the ledger on every
  // render, never stored. It is what the note column shows when there is no
  // note, so a factual note never has to be typed.
  const derived = ledgerSummary(t, currencySymbol[currencyForRegion(t.region)]);
  // Reference-data notes (the instrument's name, hand-typed) are not shown: the
  // name is already rendered under the ticker. Hiding is display only — the
  // stored text comes back untouched in the edit row below.
  const note = classifyNote(t.notes, { ticker: t.ticker, name });

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
              <p className="max-w-xs text-xs text-ink-500">
                {note.kind === "reference"
                  ? "Just the instrument's name — the ledger shows that from the ticker lookup, so this can be cleared."
                  : `Kept as typed. The ledger line is derived from the transaction: ${derived}`}
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
      <td className="num hidden text-right lg:table-cell">
        {symbol}
        {formatAmount(t.transactionValue)}
      </td>
      {/* One line, and its preferred content is the owner's own words. With no
          note the column shows the derived ledger line instead (muted, since it
          is generated rather than written). The 11rem cap is the width this
          table was tuned to in Part 23 — widening it to fit the derived line
          pushed a 1280px desktop into a horizontal scroll, so the line
          truncates and the whole of it stays one hover away. */}
      <td
        className={`max-w-[11rem] truncate text-left ${
          note.note ? "text-ink-300" : "text-ink-500"
        }`}
        title={note.note ? `${note.note} — ${derived}` : derived}
      >
        {note.note ?? <LedgerLine row={t} symbol={symbol} />}
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
