"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
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

type Tab = "group" | "individual";

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("group");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toLocalDateInputValue(new Date());

  // Coming here from the home page's "Record a deposit" shortcut
  // (?add=1) opens the form immediately instead of landing on a page
  // where you still have to click a button.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add")) {
      setOpen(true);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function handleIndividualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      contributorName: form.get("contributorName"),
      label: form.get("label"),
      date: form.get("date"),
      paidOn: form.get("paidOn"),
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
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGroupSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const label = form.get("label");
    const date = form.get("date");
    const paidOn = form.get("paidOn");
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
        body: JSON.stringify({ label, date, paidOn, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save contributions");
      }
      close();
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
        Record a deposit
      </button>
    );
  }

  return (
    <>
      {/* Mobile Slide-Up Bottom Sheet (< sm) */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:hidden"
        onClick={close}
      >
        <div
          className="panel flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-b-none border-b-0 p-5 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto -mt-2 mb-3 h-1 w-10 shrink-0 rounded-full bg-ink-700" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink-100">Record a deposit</h2>
            <button
              type="button"
              onClick={close}
              className="text-ink-300 hover:text-ink-100"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-4 flex rounded-md border border-ink-700 p-0.5 text-xs w-full">
            <button
              type="button"
              onClick={() => setTab("group")}
              className={`flex-1 rounded py-1.5 transition ${tab === "group" ? "bg-accent text-ink-950 font-medium" : "text-ink-300"}`}
            >
              Group split
            </button>
            <button
              type="button"
              onClick={() => setTab("individual")}
              className={`flex-1 rounded py-1.5 transition ${tab === "individual" ? "bg-accent text-ink-950 font-medium" : "text-ink-300"}`}
            >
              Individual deposit
            </button>
          </div>

          {tab === "group" ? (
            <form onSubmit={handleGroupSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Label</label>
                  <input name="label" required defaultValue={nextMonthLabel} className="field text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Month</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={nextMonthDate}
                    className="field text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Paid on</label>
                <input
                  name="paidOn"
                  type="date"
                  defaultValue={today}
                  className="field text-xs"
                />
              </div>

              <div className="mt-2 border-t border-ink-800 pt-3">
                <p className="mb-2 text-xs font-medium text-ink-300">Stakeholder amounts (S$)</p>
                <div className="grid grid-cols-2 gap-2">
                  {knownContributors.map((name) => (
                    <div key={name} className="flex flex-col gap-1">
                      <label className="text-[11px] text-ink-500">{name}</label>
                      <input
                        name={`amount:${name}`}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={DEFAULT_MONTHLY_AMOUNTS[name] ?? 0}
                        className="field text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? "Saving…" : "Save month"}
                </button>
                <button type="button" className="btn-ghost" onClick={close} disabled={submitting}>
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-loss">{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleIndividualSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Stakeholder</label>
                <input
                  name="contributorName"
                  list="contributor-list-mobile"
                  required
                  className="field text-xs"
                  placeholder="e.g. Josh"
                />
                <datalist id="contributor-list-mobile">
                  {knownContributors.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Label</label>
                  <input name="label" required className="field text-xs" placeholder="e.g. SEP (2026)" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Amount (S$)</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="field text-xs"
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Month</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={today}
                    className="field text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-ink-300">Paid on</label>
                  <input
                    name="paidOn"
                    type="date"
                    defaultValue={today}
                    className="field text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? "Saving…" : "Save deposit"}
                </button>
                <button type="button" className="btn-ghost" onClick={close} disabled={submitting}>
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-loss">{error}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Desktop Inline Panel (>= sm) */}
      <div className="panel hidden sm:flex flex-col gap-4 p-4">
        <div className="flex rounded-md border border-ink-700 p-0.5 text-xs w-fit">
          <button
            type="button"
            onClick={() => setTab("group")}
            className={`rounded px-3 py-1.5 transition ${tab === "group" ? "bg-accent text-ink-950 font-medium" : "text-ink-300"}`}
          >
            Group
          </button>
          <button
            type="button"
            onClick={() => setTab("individual")}
            className={`rounded px-3 py-1.5 transition ${tab === "individual" ? "bg-accent text-ink-950 font-medium" : "text-ink-300"}`}
          >
            Individual
          </button>
        </div>

        {tab === "group" ? (
          <form onSubmit={handleGroupSubmit} className="flex flex-col gap-3">
            <p className="text-xs text-ink-500">
              Prefilled with the next month and the standard split — adjust any amount before
              saving.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Label</label>
                <input name="label" required defaultValue={nextMonthLabel} className="field w-36" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Month</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={nextMonthDate}
                  className="field w-36"
                  title="The month this deposit is attributed to"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-300">Paid on</label>
                <input
                  name="paidOn"
                  type="date"
                  defaultValue={today}
                  className="field w-36"
                  title="When the money actually arrived — defaults to today, because a deposit is usually recorded when it lands. Clear it to leave the date unknown."
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
              <button type="button" className="btn-ghost" onClick={close} disabled={submitting}>
                Cancel
              </button>
            </div>
            {error && <p className="text-sm text-loss">{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleIndividualSubmit} className="flex flex-wrap items-end gap-3">
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
              <input name="label" required className="field w-36" placeholder="e.g. SEP (2026)" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Month</label>
              <input
                name="date"
                type="date"
                required
                defaultValue={today}
                className="field w-36"
                title="The month this deposit is attributed to"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-ink-300">Paid on</label>
              <input
                name="paidOn"
                type="date"
                defaultValue={today}
                className="field w-36"
                title="When the money actually arrived (empty = unknown)"
              />
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
              <button type="button" className="btn-ghost" onClick={close} disabled={submitting}>
                Cancel
              </button>
            </div>
            {error && <p className="w-full text-sm text-loss">{error}</p>}
          </form>
        )}
      </div>
    </>
  );
}
