"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LedgerRow } from "@/lib/portfolio-engine";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatQty, formatAmount, PlainMoney } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";
import RegionFlag from "@/components/RegionFlag";
import { noteCell } from "@/lib/notes";
import LedgerLine from "@/components/LedgerLine";

export default function MobileTransactionCard({
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

  const symbol = currencySymbol[currencyForRegion(t.region)];
  const cell = noteCell(t, symbol, t.notes, {
    ticker: t.ticker,
    name,
  });

  const isBuy = t.action === "Buy";
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
      <div className="p-3.5 bg-ink-900 border-b border-ink-700/60">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Date</label>
              <input name="date" type="date" required defaultValue={dateStr} className="field text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Action</label>
              <select name="action" required defaultValue={t.action} className="field text-xs">
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Ticker</label>
              <input name="ticker" required defaultValue={t.ticker} className="field text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Region</label>
              <select name="region" required defaultValue={t.region} className="field text-xs">
                <option value="US">US</option>
                <option value="SG">SG</option>
                <option value="HK">HK</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Qty</label>
              <input
                name="qty"
                type="number"
                step="0.0001"
                min="0"
                required
                defaultValue={t.qty}
                className="field text-xs"
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
                className="field text-xs"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Note</label>
            <input
              name="notes"
              defaultValue={t.notes ?? ""}
              className="field text-xs"
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary-sm flex-1" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setEditing(false)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-loss">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 p-3.5 transition ${t.runningQty < 0 ? "bg-loss/10" : ""}`}>
      {/* Top line: Action, Ticker, Flag, Date */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${isBuy ? "badge-gain" : "badge-loss"}`}>
            {t.action}
          </span>
          <span className="num font-semibold text-ink-100">{t.ticker}</span>
          <RegionFlag region={t.region} />
          {name && <span className="truncate text-xs text-ink-500 max-w-[140px]">{name}</span>}
        </div>
        <span className="num text-xs text-ink-500">{formatShortDate(new Date(t.date))}</span>
      </div>

      {/* Figures line: Qty @ Price on Left; Total Transaction Value on Right */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-ink-100 font-medium">{formatQty(t.qty)} shares</span>
          <span className="text-ink-500">@ {symbol}{formatAmount(t.price)}</span>
        </div>
        <div className="num font-medium text-ink-100 text-sm">
          <PlainMoney value={t.transactionValue} symbol={symbol} />
        </div>
      </div>

      {/* Derived facts / Note row & Action buttons */}
      <div className="flex items-start justify-between gap-3 border-t border-ink-800/80 pt-2 text-xs">
        <div className="min-w-0 flex-1 truncate text-ink-500" title={cell.text}>
          <LedgerLine parts={cell.derived.parts} note={cell.appended} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xs text-ink-300 hover:text-accent"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xs text-ink-300 hover:text-loss disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
