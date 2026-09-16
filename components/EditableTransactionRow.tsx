"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { LedgerRow } from "@/lib/portfolio-engine";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatQty, formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";

export default function EditableTransactionRow({ t }: { t: LedgerRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = new Date(t.date).toISOString().slice(0, 10);

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
      <tr className="bg-surface-raised">
        <td colSpan={11} className="px-3.5 py-4">
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="label">Date</label>
              <input name="date" type="date" required defaultValue={dateStr} className="field w-36" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Action</label>
              <select name="action" required defaultValue={t.action} className="field w-28">
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Ticker</label>
              <input name="ticker" required defaultValue={t.ticker} className="field w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Region</label>
              <select name="region" required defaultValue={t.region} className="field w-24">
                <option value="US">US</option>
                <option value="SG">SG</option>
                <option value="HK">HK</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Qty</label>
              <input
                name="qty"
                type="number"
                step="0.0001"
                min="0"
                required
                defaultValue={t.qty}
                className="field w-24 text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Price</label>
              <input
                name="price"
                type="number"
                step="0.0001"
                min="0"
                required
                defaultValue={t.price}
                className="field w-28 text-right"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Notes</label>
              <input name="notes" defaultValue={t.notes ?? ""} className="field w-56" />
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
            {error && <p className="w-full text-sm text-negative">{error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  const symbol = currencySymbol[currencyForRegion(t.region)];
  const negativeQty = t.runningQty < 0;

  return (
    <tr className={negativeQty ? "row-danger" : undefined}>
      <td className="num whitespace-nowrap">{formatShortDate(new Date(t.date))}</td>
      <td>
        <span className={`pill ${t.action === "Buy" ? "pill-accent" : "pill-muted"}`}>
          {t.action}
        </span>
      </td>
      <td className="num cell-strong">{t.ticker}</td>
      <td>{t.region}</td>
      <td className="num text-right cell-strong">{formatQty(t.qty)}</td>
      <td className="num text-right">
        {symbol}
        {formatAmount(t.price)}
      </td>
      <td className={`num text-right ${negativeQty ? "text-negative" : "cell-strong"}`}>
        {formatQty(t.runningQty)}
      </td>
      <td className="num text-right">
        {symbol}
        {formatAmount(t.runningAvgCost)}
      </td>
      <td className="num text-right">
        {symbol}
        {formatAmount(t.transactionValue)}
      </td>
      <td className="max-w-xs truncate text-left" title={t.notes ?? undefined}>
        {t.notes}
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setEditing(true)}
            className="btn-inline"
            title="Edit transaction"
            aria-label="Edit transaction"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="btn-inline-danger"
            title="Delete transaction"
            aria-label="Delete transaction"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </td>
    </tr>
  );
}
