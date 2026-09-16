"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toLocalDateInputValue } from "@/lib/dates";

export default function AddTransactionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toLocalDateInputValue(new Date());

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
      <button
        className="btn-primary inline-flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} strokeWidth={1.5} aria-hidden />
        Log a transaction
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-wrap items-end gap-4 p-5">
      <div className="flex flex-col gap-1">
        <label className="label">Date</label>
        <input name="date" type="date" required defaultValue={today} className="field w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">Action</label>
        <select name="action" required className="field w-28">
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">Ticker</label>
        <input name="ticker" required className="field w-24" placeholder="VOO" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">Region</label>
        <select name="region" required className="field w-24">
          <option value="US">US</option>
          <option value="SG">SG</option>
          <option value="HK">HK</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="label">Qty</label>
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
        <label className="label">Price</label>
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
        <label className="label">Notes</label>
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
      {error && <p className="w-full text-sm text-negative">{error}</p>}
    </form>
  );
}
