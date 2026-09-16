"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlainMoney } from "@/components/SignedNumber";
import { Check, X } from "lucide-react";

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
    return <span className="text-ink-500">—</span>;
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
        <PlainMoney value={cell.amount} />
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
              <td className="text-ink-300">{row.label}</td>
              {row.cells.map((cell) => (
                <td key={cell.name} className="text-right">
                  <PivotCell cell={cell} />
                </td>
              ))}
              <td className="text-right font-medium">
                <PlainMoney value={row.rowTotal} />
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
                  <PlainMoney value={contributorTotals[name] ?? 0} />
                </td>
              ))}
              <td className="text-right">
                <PlainMoney value={grandTotal} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
