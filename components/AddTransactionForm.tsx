"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddTransactionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save transaction");
      }
      (e.target as HTMLFormElement).reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Log a transaction
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-wrap items-end gap-3 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Date</label>
        <input name="date" type="date" required defaultValue={today} className="field w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Action</label>
        <select name="action" required className="field w-28">
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Ticker</label>
        <input name="ticker" required className="field w-24" placeholder="VOO" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Region</label>
        <select name="region" required className="field w-24">
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
          className="field w-24"
          placeholder="5"
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
          className="field w-28"
          placeholder="546.00"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Notes</label>
        <input name="notes" className="field w-56" placeholder="Optional" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setOpen(false)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
      {error && <p className="w-full text-sm text-loss">{error}</p>}
    </form>
  );
}
