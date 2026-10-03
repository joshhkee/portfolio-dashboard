"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toLocalDateInputValue } from "@/lib/dates";

export default function AddTransactionForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the Buy branch carries a DCA marker, so the action is controlled: a
  // "DCA buy" checkbox on a sale would be a control for a thing that cannot be.
  const [action, setAction] = useState("Buy");

  const today = toLocalDateInputValue(new Date());

  // Coming here from the home page's "Log a transaction" shortcut
  // (?add=1) opens the form immediately instead of landing on a page
  // where you still have to click a button.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add")) {
      setOpen(true);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    // The DCA marker lives in the note, and that is the whole storage cost of
    // the feature: the ledger already reads the note back, and a stored `kind`
    // column would be a second source of truth for the same fact (see
    // lib/notes.ts). Whatever the owner typed still lands after the marker.
    const noteText = String(form.get("notes") ?? "").trim();
    const dca = action === "Buy" && form.get("dca") === "on";
    const payload = {
      date: form.get("date"),
      action: form.get("action"),
      ticker: form.get("ticker"),
      region: form.get("region"),
      qty: form.get("qty"),
      price: form.get("price"),
      notes: dca ? (noteText ? `DCA · ${noteText}` : "DCA") : noteText,
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
      <button className="btn-primary-sm" onClick={() => setOpen(true)}>
        Log a transaction
      </button>
    );
  }

  return (
    <>
      {/* Mobile backdrop (< sm) */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:hidden"
        onClick={() => setOpen(false)}
      >
        <div
          className="panel flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-b-none border-b-0 p-5 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto -mt-2 mb-3 h-1 w-10 shrink-0 rounded-full bg-ink-700" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-100">Log a transaction</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-300 hover:text-ink-100"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Date</label>
                <input name="date" type="date" required defaultValue={today} className="field text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Action</label>
                <select
                  name="action"
                  required
                  className="field text-xs"
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Ticker</label>
                <input name="ticker" required className="field text-xs" placeholder="VOO" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Region</label>
                <select name="region" required className="field text-xs">
                  <option value="US">US</option>
                  <option value="SG">SG</option>
                  <option value="HK">HK</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Qty</label>
                <input
                  name="qty"
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  className="field text-xs"
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
                  className="field text-xs"
                  placeholder="546.00"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Notes</label>
              <input name="notes" className="field text-xs" placeholder="Optional" />
            </div>

            {action === "Buy" && (
              <label
                className="flex items-center gap-2 text-xs text-ink-300"
                title="A scheduled buy — the ledger will show it as DCA (month) and the average it left behind."
              >
                <input type="checkbox" name="dca" className="h-4 w-4 accent-accent" />
                DCA buy
              </label>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                {submitting ? "Saving…" : "Save transaction"}
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
            {error && <p className="text-xs text-loss">{error}</p>}
          </form>
        </div>
      </div>

      {/* Desktop inline panel (>= sm) */}
      <form onSubmit={handleSubmit} className="panel hidden sm:flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-300">Date</label>
          <input name="date" type="date" required defaultValue={today} className="field w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-300">Action</label>
          <select
            name="action"
            required
            className="field w-28"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
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
        {action === "Buy" && (
          <label
            className="flex h-[34px] items-center gap-2 text-xs text-ink-300"
            title="A scheduled buy — the ledger will show it as DCA (month) and the average it left behind."
          >
            <input type="checkbox" name="dca" className="h-3.5 w-3.5 accent-accent" />
            DCA buy
          </label>
        )}
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
    </>
  );
}
