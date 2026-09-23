"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      {/* Sits with the note field because it WRITES one: the ledger recognises a
          DCA by the note's own leading word, so this is the note being composed,
          not a separate field. Hidden on a sale, where the marker cannot apply. */}
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
  );
}
