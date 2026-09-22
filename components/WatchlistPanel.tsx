"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Pencil } from "lucide-react";
import { currencySymbol, currencyForRegion } from "@/lib/fx";
import { priceKey } from "@/lib/prices";
import { PlainMoney, Percent } from "@/components/SignedNumber";
import Sparkline from "@/components/Sparkline";
import TickerName from "@/components/TickerName";
import type { WatchlistRow } from "@/lib/watchlist";

export default function WatchlistPanel({ initialRows }: { initialRows: WatchlistRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<WatchlistRow[]>(initialRows);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  // One batched request for every row's 30-day trend, exactly as the positions
  // tables do — see app/api/sparklines/route.ts. Keyed by priceKey(), which is
  // both what the response is keyed by and what the request is built from.
  const [trends, setTrends] = useState<Record<string, number[]>>({});
  const trendKeys = useMemo(
    () => rows.map((r) => priceKey(r.region, r.ticker)).join(","),
    [rows]
  );

  useEffect(() => {
    if (!trendKeys) return;
    let cancelled = false;
    fetch(`/api/sparklines?keys=${encodeURIComponent(trendKeys)}`)
      .then((res) => (res.ok ? res.json() : { series: {} }))
      .then((data) => {
        if (!cancelled) setTrends(data.series ?? {});
      })
      .catch(() => {
        if (!cancelled) setTrends({});
      });
    return () => {
      cancelled = true;
    };
  }, [trendKeys]);

  // Refresh quotes every 60s while the tab is open. Names and trends ride along
  // in the same response, so a row never half-updates.
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/watchlist");
        if (!res.ok) return;
        const data = await res.json();
        setRows((current) => {
          // A row being edited keeps its local note: a poll that landed while
          // you were typing would otherwise overwrite what you were writing.
          const openRow = current.find((r) => r.id === editing);
          const next: WatchlistRow[] = data.items;
          return openRow ? next.map((r) => (r.id === openRow.id ? { ...r, notes: openRow.notes } : r)) : next;
        });
        setRefreshedAt(new Date().toLocaleTimeString());
      } catch {
        // ignore transient refresh failures
      }
    }
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [editing]);

  async function refreshRows() {
    const res = await fetch("/api/watchlist");
    if (res.ok) {
      const data = await res.json();
      setRows(data.items);
    }
  }

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

  /** Save a row's reason. Blank clears it; Escape reverts without writing. */
  async function saveNote(id: number, notes: string) {
    const clean = notes.trim();
    setRows((current) => current.map((r) => (r.id === id ? { ...r, notes: clean || null } : r)));
    setEditing(null);
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, notes: clean || null }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {refreshedAt ? `Quotes refreshed ${refreshedAt}` : "Prices and changes update each minute"}
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
          {/* The width lives on the WRAPPER, not the control: `.field` is a
              component-layer rule and it carries `w-full`, and `@layer
              components` beats the utilities layer whatever the class order —
              so `w-28` on the input itself silently does nothing and the field
              collapses to whatever flex gives it. Sizing the wrapper is what
              the layer order actually respects. */}
          <div className="flex w-28 flex-col gap-1">
            <label className="text-xs text-ink-300">Ticker</label>
            <input name="ticker" required className="field" placeholder="NVDA" autoFocus />
          </div>
          <div className="flex w-24 flex-col gap-1">
            <label className="text-xs text-ink-300">Region</label>
            <select name="region" required className="field" defaultValue="US">
              <option value="US">US</option>
              <option value="SG">SG</option>
              <option value="HK">HK</option>
            </select>
          </div>
          <div className="flex w-64 flex-col gap-1">
            <label className="text-xs text-ink-300">Why</label>
            <input name="notes" className="field" placeholder="What you're waiting for" />
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

      {/* `table-compact` (min-w-0) rather than the ledger's 720px floor: this is
          a handful of short columns, and the ledger's minimum made a phone
          scroll sideways for no reason. The trend column drops below `sm` and
          the reason column below `md`, so nothing is ever clipped — each of
          them is one hover (or one column) away from what remains. */}
      <div className="panel overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-300">
            Nothing on the watchlist yet. Track a ticker you are considering buying.
          </p>
        ) : (
          <table className="ledger-table table-compact">
            <thead>
              {/* Every column but `Why` is pinned to a width, so the slack in a
                  full-width table lands on the one column whose contents
                  actually vary — a reason can be a sentence, and a price is
                  always seven characters. Without this the instrument column
                  absorbed ~560px of whitespace and the reason got 264px. */}
              <tr>
                <th className="w-[24rem]">Ticker</th>
                <th className="w-[7rem] text-right">Price</th>
                <th className="w-[6rem] text-right">Today</th>
                <th
                  className="hidden w-[6rem] text-right sm:table-cell"
                  title="Price trend over the last 30 days"
                >
                  30d
                </th>
                <th className="hidden md:table-cell">Why</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const symbol = currencySymbol[currencyForRegion(r.region)];
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="num">{r.ticker}</span>
                      {/* Region is a cell's worth of width for two letters; it
                          rides on the name line instead. */}
                      {/* A roomier budget than the ledger's 13rem: this table has
                          five columns, so a long fund name has somewhere to go
                          and truncating it next to empty space reads as a bug. */}
                      <TickerName
                        region={r.region}
                        ticker={r.ticker}
                        name={r.name}
                        maxWidthClass="max-w-[10rem] sm:max-w-[22rem]"
                      />
                      <span className="num ml-2 text-xs text-ink-500">{r.region}</span>
                    </td>
                    <td className="num text-right">
                      {r.price !== null ? (
                        <PlainMoney value={r.price} symbol={symbol} />
                      ) : (
                        <span className="text-ink-500" title="No live quote available">
                          —
                        </span>
                      )}
                    </td>
                    {/* The only figure on the row that carries colour, because it
                        is the only one that means up or down. */}
                    <td className="num text-right">
                      {r.dayChangePct !== null ? (
                        <Percent value={r.dayChangePct} />
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell">
                      {trends[priceKey(r.region, r.ticker)] ? (
                        <Sparkline values={trends[priceKey(r.region, r.ticker)]} />
                      ) : (
                        <span className="text-xs text-ink-500" title="No recent history available">
                          —
                        </span>
                      )}
                    </td>
                    <td className="hidden max-w-[22rem] md:table-cell">
                      {editing === r.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            saveNote(r.id, String(new FormData(e.currentTarget).get("notes") ?? ""));
                          }}
                        >
                          <input
                            name="notes"
                            defaultValue={r.notes ?? ""}
                            autoFocus
                            placeholder="What you're waiting for"
                            className="field px-1.5 py-0.5 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditing(null);
                            }}
                            // Clicking away settles it, the same rule the
                            // exposure tag chips use, so a row can never show a
                            // value it did not store.
                            onBlur={(e) => saveNote(r.id, e.currentTarget.value)}
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing(r.id)}
                          className="group/why flex w-full items-center gap-1.5 text-left"
                          title={r.notes ?? "Add a reason for watching this"}
                        >
                          <span className={`min-w-0 truncate ${r.notes ? "text-ink-100" : "text-ink-500"}`}>
                            {r.notes ?? "Add a reason"}
                          </span>
                          <Pencil
                            size={10}
                            strokeWidth={2}
                            className="shrink-0 text-ink-500 opacity-0 transition group-hover/why:opacity-100"
                          />
                        </button>
                      )}
                    </td>
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
