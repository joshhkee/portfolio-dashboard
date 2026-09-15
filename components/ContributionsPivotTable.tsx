"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      <form onSubmit={handleSave} className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            defaultValue={cell.amount}
            className="field w-20 px-1 py-0.5 text-center"
          />
          <button type="submit" className="text-xs text-gain hover:brightness-125" disabled={busy} title="Save">
            ✓
          </button>
          <button
            type="button"
            className="text-xs text-ink-300 hover:text-ink-100"
            onClick={() => setEditing(false)}
            disabled={busy}
            title="Cancel"
          >
            ×
          </button>
        </div>
        {error && <p className="text-[10px] text-loss">{error}</p>}
      </form>
    );
  }

  return (
    <div className="group flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hover:text-accent"
        title="Edit this contribution"
      >
        <PlainMoney value={cell.amount} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-xs text-ink-500 opacity-0 transition hover:text-loss group-hover:opacity-100 disabled:opacity-50"
        title="Delete this contribution"
      >
        ×
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
              <th key={name}>{name}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {labelRows.map((row) => (
            <tr key={row.label}>
              <td className="text-ink-300">{row.label}</td>
              {row.cells.map((cell) => (
                <td key={cell.name}>
                  <PivotCell cell={cell} />
                </td>
              ))}
              <td className="font-medium">
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
                <td key={name}>
                  <PlainMoney value={contributorTotals[name] ?? 0} />
                </td>
              ))}
              <td>
                <PlainMoney value={grandTotal} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
