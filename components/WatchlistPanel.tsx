"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { formatAmount } from "@/components/SignedNumber";

interface WatchRow {
  id: number;
  region: string;
  ticker: string;
  notes: string | null;
  price: number | null;
}

export default function WatchlistPanel({ initialRows }: { initialRows: WatchRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<WatchRow[]>(initialRows);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  // Refresh quotes every 60s while the tab is open.
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/watchlist");
        if (!res.ok) return;
        const data = await res.json();
        setRows(data.items);
        setRefreshedAt(new Date().toLocaleTimeString());
      } catch {
        // ignore transient refresh failures
      }
    }
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.get("ticker"),
          region: form.get("region"),
          notes: form.get("notes"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add");
      }
      (e.target as HTMLFormElement).reset();
      setAdding(false);
      await refreshRows();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function refreshRows() {
    const res = await fetch("/api/watchlist");
    if (res.ok) {
      const data = await res.json();
      setRows(data.items);
    }
  }

  async function handleRemove(id: number) {
    setBusy(true);
    try {
      await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
      await refreshRows();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-300">
          Tickers you&apos;re tracking without holding
          {refreshedAt && <span className="ml-2 text-xs text-ink-500">refreshed {refreshedAt}</span>}
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost flex items-center gap-1.5">
            <Plus size={14} strokeWidth={2.5} />
            Track a ticker
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="panel flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Ticker</label>
            <input name="ticker" required className="field w-28" placeholder="NVDA" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Region</label>
            <select name="region" required className="field w-24" defaultValue="US">
              <option value="US">US</option>
              <option value="SG">SG</option>
              <option value="HK">HK</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-300">Notes</label>
            <input name="notes" className="field w-56" placeholder="Optional" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Add"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {error && <p className="w-full text-sm text-loss">{error}</p>}
        </form>
      )}

      {/* `overflow-x-auto`, not `overflow-hidden`: .ledger-table forces a
          720px min-width, so on anything narrower than that the hidden-overflow
          variant silently CUT OFF the notes and the remove button with no way
          to reach them. `table-compact` drops the min-width instead — this is a
          five-column table of short values, so it fits a phone on its own and
          needs no scroll container at all. The auto overflow stays as a safety
          net for a very long note. */}
      <div className="panel overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-300">Watchlist is empty.</p>
        ) : (
          <table className="ledger-table table-compact">
            <thead>
              <tr>
                <th>Region</th>
                <th>Ticker</th>
                <th className="text-right">Price</th>
                {/* Notes are secondary on a phone: with them in, the table still
                    measured 384px against a 290px box, so the remove button sat
                    off-screen. Dropping just this column fits the whole row. */}
                <th className="hidden sm:table-cell">Notes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const symbol = currencySymbol[currencyForRegion(r.region)];
                return (
                  <tr key={r.id}>
                    <td className="text-ink-300">{r.region}</td>
                    <td className="num">{r.ticker}</td>
                    <td className="num text-right">
                      {r.price !== null ? (
                        <>
                          {symbol}
                          {formatAmount(r.price)}
                        </>
                      ) : (
                        <span className="text-ink-500" title="No live quote available">
                          —
                        </span>
                      )}
                    </td>
                    <td className="hidden text-ink-300 sm:table-cell">{r.notes ?? ""}</td>
                    <td className="text-right">
                      <button
                        onClick={() => handleRemove(r.id)}
                        disabled={busy}
                        className="text-ink-500 transition hover:text-loss"
                        title={`Remove ${r.ticker} from watchlist`}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
