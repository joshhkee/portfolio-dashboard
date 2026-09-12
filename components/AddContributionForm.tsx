"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toLocalDateInputValue } from "@/lib/dates";

// The standard monthly split observed in the contribution history —
// everyone puts in 500 except Chin at 200. Editable per-month below in
// case a particular month's split needs to differ.
const DEFAULT_MONTHLY_AMOUNTS: Record<string, number> = {
  Josh: 500,
  Roy: 500,
  Chin: 200,
  Keng: 500,
  Zhiming: 500,
};

type Mode = "closed" | "single" | "default-month";

export default function AddContributionForm({
  knownContributors,
  nextMonthLabel,
  nextMonthDate,
}: {
  knownContributors: string[];
  nextMonthLabel: string;
  nextMonthDate: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("closed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toLocalDateInputValue(new Date());

  async function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      contributorName: form.get("contributorName"),
      label: form.get("label"),
      date: form.get("date"),
      amount: form.get("amount"),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save contribution");
      }
      (e.target as HTMLFormElement).reset();
      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDefaultMonthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const label = form.get("label");
    const date = form.get("date");
    const entries = knownContributors
      .map((name) => ({
        contributorName: name,
        amount: Number(form.get(`amount:${name}`)),
      }))
      .filter((entry) => entry.amount > 0);

    if (entries.length === 0) {
      setError("At least one stakeholder needs a positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, date, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save contributions");
      }
      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setMode("single")}>
          Record a deposit
        </button>
        <button className="btn-ghost" onClick={() => setMode("default-month")}>
          Add default month
        </button>
      </div>
    );
  }

  if (mode === "default-month") {
    return (
      <form
        onSubmit={handleDefaultMonthSubmit}
        className="panel flex flex-col gap-3 p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Label</label>
            <input name="label" required defaultValue={nextMonthLabel} className="field w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Date</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={nextMonthDate}
              className="field w-36"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {knownContributors.map((name) => (
            <div key={name} className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">{name}</label>
              <input
                name={`amount:${name}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={DEFAULT_MONTHLY_AMOUNTS[name] ?? 0}
                className="field w-24"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Add month"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMode("closed")}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-loss">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSingleSubmit} className="panel flex flex-wrap items-end gap-3 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Stakeholder</label>
        <input
          name="contributorName"
          list="contributor-list"
          required
          className="field w-40"
          placeholder="e.g. Josh"
        />
        <datalist id="contributor-list">
          {knownContributors.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Label</label>
        <input
          name="label"
          required
          className="field w-36"
          placeholder="e.g. SEP (2026)"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Date</label>
        <input name="date" type="date" required defaultValue={today} className="field w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-300">Amount</label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          className="field w-32"
          placeholder="500.00"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setMode("closed")}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
      {error && <p className="w-full text-sm text-loss">{error}</p>}
    </form>
  );
}
