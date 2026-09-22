"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/components/SignedNumber";

export interface TaggablePosition {
  region: string;
  ticker: string;
  name: string | null;
  /** Holding value in SGD, so the list can be ordered by what matters. */
  valueSgd: number;
  sector: string | null;
}

const SUGGESTIONS_ID = "sector-suggestions";

/**
 * Tag each held instrument with its sector / asset class.
 *
 * This exists because no free data source classifies these instruments: the
 * tag can only come from the owner, so the job is to make doing it fast rather
 * than clever. One row per instrument, biggest holding first, Enter to save.
 *
 * Deliberately not a multi-select of pre-canned sectors: the autocomplete list
 * is built from tags ALREADY IN USE, so an existing classification can be
 * reused with one keystroke while a new one can still be typed. Nothing here
 * guesses, and an untagged instrument stays visibly untagged rather than
 * defaulting into a bucket nobody chose.
 */
export default function SectorTagEditor({ positions }: { positions: TaggablePosition[] }) {
  const router = useRouter();
  const [value, setValue] = useState<Record<string, string>>(() =>
    Object.fromEntries(positions.map((p) => [key(p), p.sector ?? ""]))
  );
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(positions.map((p) => [key(p), p.sector ?? ""]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every tag currently in use, as autocomplete options.
  const inUse = Array.from(
    new Set(positions.map((p) => p.sector).filter((s): s is string => !!s))
  ).sort();

  async function save(e: React.FormEvent<HTMLFormElement>, position: TaggablePosition) {
    e.preventDefault();
    const id = key(position);
    const next = (value[id] ?? "").trim();
    setError(null);
    setBusy(id);
    try {
      const res = await fetch("/api/ticker-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: position.region,
          ticker: position.ticker,
          sector: next,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save the tag");
      }
      setSaved((prev) => ({ ...prev, [id]: next }));
      setValue((prev) => ({ ...prev, [id]: next }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const untagged = positions.filter((p) => !p.sector).length;

  if (positions.length === 0) {
    return <p className="text-sm text-ink-300">No open positions to tag.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id={SUGGESTIONS_ID}>
        {inUse.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="flex flex-col divide-y divide-ink-700">
        {positions.map((position) => {
          const id = key(position);
          const dirty = (value[id] ?? "").trim() !== (saved[id] ?? "");
          return (
            <form
              key={id}
              onSubmit={(e) => save(e, position)}
              className="flex items-center gap-3 py-2"
            >
              <span className="w-20 shrink-0">
                <span className="num block truncate text-xs text-ink-100" title={position.ticker}>
                  {position.ticker}
                </span>
                <span className="block truncate text-[10px] text-ink-500" title={position.name ?? undefined}>
                  {position.name ?? position.region}
                </span>
              </span>
              <span className="num w-24 shrink-0 text-right text-xs text-ink-300">
                S${formatAmount(position.valueSgd)}
              </span>
              <input
                list={SUGGESTIONS_ID}
                value={value[id] ?? ""}
                onChange={(e) => setValue((prev) => ({ ...prev, [id]: e.target.value }))}
                onKeyDown={(e) => {
                  // Escape reverts rather than clearing — clearing a tag is a
                  // deliberate act (save an empty field), not a slip of a key.
                  if (e.key === "Escape") {
                    setValue((prev) => ({ ...prev, [id]: saved[id] ?? "" }));
                  }
                }}
                placeholder="e.g. Banks"
                aria-label={`Sector for ${position.ticker}`}
                className="field min-w-0 flex-1 px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={!dirty || busy === id}
                className="w-12 shrink-0 text-xs text-accent transition hover:text-accentHover disabled:text-ink-500 disabled:hover:text-ink-500"
              >
                {busy === id ? "…" : dirty ? "Save" : position.sector ? "Saved" : "—"}
              </button>
            </form>
          );
        })}
      </div>

      <p className="text-xs text-ink-500">
        {untagged === 0
          ? "Every open position is tagged."
          : `${untagged} of ${positions.length} position${
              positions.length === 1 ? "" : "s"
            } untagged. An untagged holding counts as unclassified — it is never guessed into a sector.`}
        {" "}Tags are reusable: type one once and it appears in the list for the rest.
      </p>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}

function key(p: { region: string; ticker: string }) {
  return `${p.region}::${p.ticker}`;
}
