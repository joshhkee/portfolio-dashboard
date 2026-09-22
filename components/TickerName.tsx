"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";

/**
 * The instrument's display name, shown under its ticker, with a hand-edit
 * affordance. A name saved here is marked as overridden and is never replaced
 * by an automatic lookup (see mergeMeta in lib/ticker-meta.ts).
 *
 * Deliberately small: names are reference data, so this stays a quiet subtitle
 * that only reveals its controls on hover rather than competing with the
 * numbers in the row.
 */
export default function TickerName({
  region,
  ticker,
  name,
}: {
  region: string;
  ticker: string;
  name: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = String(new FormData(e.currentTarget).get("name") ?? "");
    setBusy(true);
    try {
      const res = await fetch("/api/ticker-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, ticker, name: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save name");
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
      <form onSubmit={handleSave} className="mt-1 flex items-center gap-1">
        <input
          name="name"
          defaultValue={name ?? ""}
          autoFocus
          placeholder={`Name for ${ticker}`}
          aria-label={`Display name for ${ticker}`}
          className="field w-44 px-1.5 py-0.5 text-xs"
        />
        <button type="submit" disabled={busy} className="text-xs text-accent hover:text-accentHover disabled:opacity-50">
          {busy ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy} className="text-xs text-ink-300 hover:text-ink-100">
          Cancel
        </button>
        {error && <span className="text-xs text-loss">{error}</span>}
      </form>
    );
  }

  return (
    // `max-w-[13rem]` bounds the cell in a sized-by-content table. Without it
    // the longest name sets the width of the whole instrument column — 330px
    // for "Vanguard Total World Stock Index Fund ETF Shares" — which pushed
    // the ledger past its container and made the date column break mid-value.
    // Truncation with the full name on hover is the honest trade.
    <span className="group/name mt-0.5 flex max-w-[13rem] items-center gap-1">
      <span className="min-w-0 truncate text-xs text-ink-300" title={name ?? undefined}>
        {name ?? "—"}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-ink-500 opacity-0 transition hover:text-accent focus:opacity-100 group-hover/name:opacity-100"
        title={name ? `Edit name for ${ticker}` : `Add a name for ${ticker}`}
        aria-label={name ? `Edit name for ${ticker}` : `Add a name for ${ticker}`}
      >
        <Pencil size={10} strokeWidth={2} />
      </button>
    </span>
  );
}
