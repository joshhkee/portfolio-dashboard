"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { PlainMoney } from "@/components/SignedNumber";

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
}

function PivotCell({ cell }: { cell: Cell }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cell.amount === null) {
    return <span className="text-fg-subtle/60">—</span>;
  }

  // A handful of duplicate rows under the same label+contributor (rare) —
  // show the combined total but don't offer edit/delete on an ambiguous
  // group of entries.
  if (cell.multiple || cell.id === null) {
    return <PlainMoney value={cell.amount} />;
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
      <form onSubmit={handleSave} className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            defaultValue={cell.amount}
            className="field w-24 px-2 py-1 text-right"
          />
          <button
            type="submit"
            className="btn-inline hover:text-positive"
            disabled={busy}
            title="Save"
          >
            <Check size={14} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            className="btn-inline hover:text-fg"
            onClick={() => setEditing(false)}
            disabled={busy}
            title="Cancel"
          >
            <X size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        {error && <p className="text-[10px] text-negative">{error}</p>}
      </form>
    );
  }

  return (
    <div className="group flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="num rounded-sm px-1.5 py-0.5 text-fg transition hover:bg-surface-raised hover:text-accent"
        title="Edit this contribution"
      >
        <PlainMoney value={cell.amount} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="btn-inline-danger"
        title="Delete this contribution"
      >
        <Trash2 size={13} strokeWidth={1.5} aria-hidden />
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
              <th key={name} className="text-right">
                {name}
              </th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {labelRows.map((row) => (
            <tr key={row.label}>
              <td className="cell-strong text-sm">{row.label}</td>
              {row.cells.map((cell) => (
                <td key={cell.name} className="text-right">
                  <PivotCell cell={cell} />
                </td>
              ))}
              <td className="num cell-strong text-right">
                <PlainMoney value={row.rowTotal} />
              </td>
            </tr>
          ))}
          {labelRows.length === 0 && (
            <tr>
              <td colSpan={contributorNames.length + 2} className="py-10 text-center">
                Nothing here yet — record the first deposit above.
              </td>
            </tr>
          )}
        </tbody>
        {labelRows.length > 0 && (
          <tfoot>
            <tr className="border-t border-line-strong">
              <td className="label border-b-0">Total</td>
              {contributorNames.map((name) => (
                <td key={name} className="num cell-strong border-b-0 text-right">
                  <PlainMoney value={contributorTotals[name] ?? 0} />
                </td>
              ))}
              <td className="num border-b-0 text-right font-medium text-accent">
                <PlainMoney value={grandTotal} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
