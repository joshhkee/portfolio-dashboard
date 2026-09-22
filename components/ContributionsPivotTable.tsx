"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlainMoney } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";
import { Check, Clock, X } from "lucide-react";

/** Every figure in this table is SGD (the ledger has no currency column), so
 * the symbol is stated rather than left as a bare "$" that reads as USD. */
const SGD = "S$";

interface Cell {
  name: string;
  id: number | null;
  amount: number | null;
  multiple: boolean;
}

interface LabelRow {
  label: string;
  dateMs: number;
  cells: Cell[];
  rowTotal: number;
  /** Arrival date of this month's lump, "YYYY-MM-DD", or null when unknown. */
  paidOn: string | null;
  /** Days past the end of the attributed month; 0 when on time or unknown. */
  daysLate: number;
  /** Every contribution under this label — a month's lump, edited together. */
  contributionIds: number[];
}

/**
 * The row's label, plus a deliberately quiet note when that month's money
 * arrived late, and an inline editor for the arrival date.
 *
 * The date lives on the LABEL because the schedule question is about a month,
 * not about one stakeholder's cell: a month's lump lands across several rows at
 * once, so editing it here writes the same date to all of them. Styling stays
 * plain text (like the amount cells) so a late month reads as a footnote
 * rather than an alert.
 */
function LabelCell({ row }: { row: LabelRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = String(new FormData(e.currentTarget).get("paidOn") ?? "");

    setBusy(true);
    try {
      const results = await Promise.all(
        row.contributionIds.map((id) =>
          fetch(`/api/contributions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paidOn: value === "" ? null : value }),
          })
        )
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const body = await failed.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            name="paidOn"
            type="date"
            autoFocus
            defaultValue={row.paidOn ?? ""}
            className="field w-36 px-1 py-1"
            title="When this month's deposit actually arrived (empty = unknown)"
          />
          <button
            type="submit"
            className="rounded-md bg-gainBg px-2.5 py-1.5 text-gain hover:brightness-125 disabled:opacity-50"
            disabled={busy}
            title="Save"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="rounded-md bg-ink-800 px-2.5 py-1.5 text-ink-300 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-50"
            onClick={() => setEditing(false)}
            disabled={busy}
            title="Cancel"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        {error && <p className="text-[10px] text-loss">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-sm px-1 py-0.5 text-left hover:bg-ink-800 hover:text-accent"
        title={
          row.paidOn
            ? `Deposit arrived ${formatShortDate(new Date(`${row.paidOn}T00:00:00.000Z`))} — click to change`
            : "Set when this deposit arrived"
        }
      >
        {row.label}
      </button>
      {/* A late deposit is a note, not a problem (money sitting in the account
          earns nothing), so this is a quiet icon rather than a label: the
          detail is there on hover for anyone who wants it. */}
      {row.daysLate > 0 && row.paidOn && (
        <span
          className="shrink-0 text-ink-500"
          role="img"
          aria-label={`Late deposit — ${row.label} allocation deposited ${formatShortDate(
            new Date(`${row.paidOn}T00:00:00.000Z`)
          )}`}
          title={`Late deposit\n${row.label} allocation deposited on ${formatShortDate(
            new Date(`${row.paidOn}T00:00:00.000Z`)
          )} — ${row.daysLate} days after the month closed.`}
        >
          <Clock size={12} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}

function PivotCell({ cell }: { cell: Cell }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cell.amount === null) {
    return <span className="text-ink-500">—</span>;
  }

  // A handful of duplicate rows under the same label+contributor (rare) —
  // show the combined total but don't offer edit/delete on an ambiguous
  // group of entries.
  if (cell.multiple || cell.id === null) {
    return <PlainMoney value={cell.amount} symbol={SGD} />;
  }

  async function handleDelete() {
    if (!confirm("Delete this contribution? This can't be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/contributions/${cell.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const amount = form.get("amount");

    setBusy(true);
    try {
      const res = await fetch(`/api/contributions/${cell.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            defaultValue={cell.amount}
            className="field w-20 px-1 py-1 text-center"
          />
          <button
            type="submit"
            className="rounded-md bg-gainBg px-2.5 py-1.5 text-gain hover:brightness-125 disabled:opacity-50"
            disabled={busy}
            title="Save"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="rounded-md bg-ink-800 px-2.5 py-1.5 text-ink-300 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-50"
            onClick={() => setEditing(false)}
            disabled={busy}
            title="Cancel"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        {error && <p className="text-[10px] text-loss">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-sm px-1 py-0.5 hover:bg-ink-800 hover:text-accent"
        title="Edit this contribution"
      >
        <PlainMoney value={cell.amount} symbol={SGD} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md px-1 py-0.5 text-ink-500 hover:bg-lossBg hover:text-loss disabled:opacity-50"
        title="Delete this contribution"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function ContributionsPivotTable({
  contributorNames,
  contributorTotals,
  labelRows,
  grandTotal,
}: {
  contributorNames: string[];
  contributorTotals: Record<string, number>;
  labelRows: LabelRow[];
  grandTotal: number;
}) {
  return (
    <div className="table-scroll">
      <table className="ledger-table">
        <thead>
          <tr>
            <th>Month / label</th>
            {contributorNames.map((name) => (
              <th key={name} className="text-right">{name}</th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {labelRows.map((row) => (
            <tr key={row.label}>
              <td className="text-ink-300">
                <LabelCell row={row} />
              </td>
              {row.cells.map((cell) => (
                <td key={cell.name} className="text-right">
                  <PivotCell cell={cell} />
                </td>
              ))}
              <td className="text-right font-medium">
                <PlainMoney value={row.rowTotal} symbol={SGD} />
              </td>
            </tr>
          ))}
          {labelRows.length === 0 && (
            <tr>
              <td colSpan={contributorNames.length + 2} className="py-6 text-center text-ink-300">
                Nothing here yet — record the first deposit above.
              </td>
            </tr>
          )}
        </tbody>
        {labelRows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-ink-600 font-medium">
              <td>Total</td>
              {contributorNames.map((name) => (
                <td key={name} className="text-right">
                  <PlainMoney value={contributorTotals[name] ?? 0} symbol={SGD} />
                </td>
              ))}
              <td className="text-right">
                <PlainMoney value={grandTotal} symbol={SGD} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
