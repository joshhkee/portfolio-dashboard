"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { formatAmount } from "@/components/SignedNumber";
import TagSelect from "@/components/TagSelect";
import { sectorTagList } from "@/lib/sectors";

export interface TaggablePosition {
  region: string;
  ticker: string;
  name: string | null;
  /** Holding value in SGD, so the list can be ordered by what matters. */
  valueSgd: number;
  sector: string | null;
  /**
   * Where the tag came from ("auto" when the classifier drafted it, "manual"
   * when it was picked or typed). Still written and stored — it is provenance
   * worth keeping — but deliberately NOT shown: what the owner asked for is a
   * tag they set once, and a badge that narrates which button produced it made
   * a settled label look like an unresolved state.
   */
  sectorSource?: string | null;
  /** First-draft tag for this instrument, or null when nothing is known. */
  suggested?: string | null;
  /** "ETF" | "EQUITY" | ... — the fund-vs-single-stock distinction. */
  instrumentType?: string | null;
}

/**
 * Column template, shared by the header and every row so the two can never
 * drift: selection, instrument, value, weight, type, tag control, action.
 *
 * It is a FLEX row below `md` and a grid above it. Seven columns on a phone is
 * a horizontal scrollbar for nothing, so there the tag control takes its own
 * line (`basis-full`) and the rest wrap; `flex-1`/`basis-full` have no meaning
 * inside a grid, which is what lets one element list carry both layouts.
 */
const ROW =
  "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700 py-2.5 md:grid md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_3.25rem_4.25rem_13rem_3.5rem]";

const HEAD =
  "hidden md:grid md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_3.25rem_4.25rem_13rem_3.5rem] md:gap-x-3 md:border-b md:border-ink-700 md:pb-1.5";

/** "EQUITY" is not a word anyone says out loud; an unreported type stays a
 *  dash rather than being called a stock by default. */
function typeLabel(type: string | null | undefined): string {
  const t = (type ?? "").toUpperCase();
  if (t === "ETF") return "Fund";
  if (t === "EQUITY") return "Stock";
  return "—";
}

function key(p: { region: string; ticker: string }) {
  return `${p.region}::${p.ticker}`;
}

function drafts(positions: TaggablePosition[]) {
  return Object.fromEntries(positions.map((p) => [key(p), p.sector ?? ""]));
}

/**
 * Tag each held instrument with its exposure.
 *
 * This exists because no free data source classifies these instruments, so the
 * job is to make doing it fast rather than clever. What that means in practice:
 *
 *  - one row per instrument, biggest holding first, Enter saves, Escape reverts;
 *  - the tag control is a dropdown over the vocabulary in lib/sectors.ts, so
 *    the same exposure lands on the same string every time, and a deliberate
 *    typo can no longer split one sector into two half-weight buckets. Free
 *    text still works, because the vocabulary is not a cage;
 *  - where the classifier has a first-draft tag it is OFFERED, never applied —
 *    "suggested: Financials" is a button, and a batch action accepts them all.
 *    It is stated on that one clickable line and nowhere else, so an empty
 *    field never looks filled in;
 *  - rows can be selected, so a sector can be applied to several instruments at
 *    once, which is the whole point of grouping (D05 and XLF are one trade).
 *
 * Deliberately not a fixed single-select: an untagged instrument stays visibly
 * untagged rather than defaulting into a bucket nobody chose.
 *
 * The control is a chip, not a field. A tag is set once and then read for
 * years, so the row rests as a label you can click — a permanently visible
 * input would say "this needs maintaining" about something that does not.
 */
export default function SectorTagEditor({
  positions,
  totalSgd,
}: {
  positions: TaggablePosition[];
  /** Total holdings value in SGD, the denominator for the weight column. */
  totalSgd: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState<Record<string, string>>(() => drafts(positions));
  const [saved, setSaved] = useState<Record<string, string>>(() => drafts(positions));
  // Which row has its editor open, if any. One at a time: these are labels you
  // set once, so the resting state of the column is a tag, not a form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchTag, setBatchTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The vocabulary first, then any tag already in use that is not in it. Legacy
  // free text keeps rendering AND stays pickable, so a tag the owner invented
  // once is offered back instead of having to be retyped.
  const options = useMemo(() => {
    const vocabulary = sectorTagList();
    const extra = Array.from(
      new Set(positions.map((p) => p.sector).filter((s): s is string => !!s))
    )
      .filter((s) => !vocabulary.includes(s))
      .sort();
    return [...vocabulary, ...extra];
  }, [positions]);

  async function write(row: TaggablePosition, next: string, src: "auto" | "manual") {
    const id = key(row);
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/ticker-meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: row.region,
          ticker: row.ticker,
          sector: next,
          source: src,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save the tag");
      }
      const body = await res.json().catch(() => ({}));
      const clean: string = typeof body.sector === "string" ? body.sector : "";
      setSaved((prev) => ({ ...prev, [id]: clean }));
      setValue((prev) => ({ ...prev, [id]: clean }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /**
   * Save one row.
   *
   * `source` defaults to "manual" — a tag the owner typed or picked IS theirs.
   * Accepting a suggestion passes "auto" instead, and that has to be the same
   * on both paths: whether a draft is accepted one row at a time or all at
   * once, the tag is the classifier's, and marking one "auto" while the other
   * is "manual" would make the chip mean "which button did I press".
   */
  async function commit(row: TaggablePosition, next: string, src: "auto" | "manual" = "manual") {
    const ok = await write(row, next, src);
    if (ok) router.refresh();
  }

  /** Apply one tag to every selected row, then clear the selection. */
  async function applyToSelected(tag: string, src: "auto" | "manual") {
    const clean = tag.trim();
    const rows = positions.filter((p) => selected.has(key(p)));
    if (rows.length === 0) return;
    let changed = 0;
    for (const row of rows) {
      // Sequential on purpose: 18 parallel PATCHes against a connection pool
      // pinned to one connection queue up anyway, and this keeps busy/error
      // attribution to a single row clear.
      const ok = await write(row, clean, src);
      if (ok) changed++;
    }
    if (changed > 0) {
      setSelected(new Set());
      setBatchTag("");
      router.refresh();
    }
  }

  /**
   * Settle a row whose editor just lost focus.
   *
   * Clicking away is a decision: a changed draft is saved, an unchanged one is
   * simply closed. Anything else leaves a row showing a value it has not
   * stored, which is exactly the kind of half-state a set-once control should
   * not have.
   */
  function settle(row: TaggablePosition, id: string) {
    const draft = (value[id] ?? "").trim();
    setEditingId(null);
    if (draft !== (saved[id] ?? "").trim()) commit(row, draft);
  }

  /** Accept the classifier's draft for every row that has one and no tag. */
  async function acceptSuggestions(rows: TaggablePosition[]) {
    for (const row of rows) {
      if (!row.suggested) continue;
      await write(row, row.suggested, "auto");
    }
    setSelected(new Set());
    router.refresh();
  }

  if (positions.length === 0) {
    return <p className="text-sm text-ink-300">No open positions to tag.</p>;
  }

  const untagged = positions.filter((p) => !saved[key(p)]?.trim());
  const suggestedRows = untagged.filter((p) => !!p.suggested);
  const allSelected = selected.size === positions.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-ink-700 bg-ink-850 px-3 py-2">
        <span className="text-xs text-ink-300">
          {selected.size === 0
            ? `${untagged.length} of ${positions.length} untagged`
            : `${selected.size} selected`}
        </span>

        <button
          type="button"
          disabled={allSelected}
          onClick={() => setSelected(new Set(positions.map(key)))}
          className="text-xs text-ink-500 transition hover:text-accent disabled:text-ink-700 disabled:hover:text-ink-700 motion-reduce:transition-none"
        >
          Select all {positions.length}
        </button>
        {/* Only offered when there is something to select — "Select the 0
            untagged" was a button whose whole effect was to select nothing. */}
        {untagged.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set(untagged.map(key)))}
            className="text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none"
          >
            Select the {untagged.length} untagged
          </button>
        )}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none"
          >
            Clear selection
          </button>
        )}

        {selected.size > 0 && (
          <span className="flex flex-wrap items-center gap-2">
            <div className="w-48">
              <TagSelect
                dense
                value={batchTag}
                options={options}
                onChange={setBatchTag}
                onCommit={setBatchTag}
                ariaLabel="tag to apply to the selected holdings"
                placeholder="Pick a tag…"
              />
            </div>
            <button
              type="button"
              disabled={!batchTag.trim() || busy !== null}
              onClick={() => applyToSelected(batchTag, "manual")}
              className="btn-ghost px-2.5 py-1 text-xs"
            >
              Apply to {selected.size}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => applyToSelected("", "manual")}
              className="text-xs text-ink-500 transition hover:text-loss motion-reduce:transition-none"
            >
              Untag selected
            </button>
          </span>
        )}

        {suggestedRows.length > 0 && busy === null && (
          <button
            type="button"
            onClick={() => acceptSuggestions(suggestedRows)}
            className="ml-auto text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none"
            title="Use the suggested tag for each untagged holding. Every one stays editable."
          >
            Accept the {suggestedRows.length} suggestion
            {suggestedRows.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className={HEAD}>
        <span />
        <span className="text-[10px] uppercase tracking-wide text-ink-500">Instrument</span>
        <span className="text-right text-[10px] uppercase tracking-wide text-ink-500">Value</span>
        <span className="text-right text-[10px] uppercase tracking-wide text-ink-500">Wt</span>
        <span className="text-[10px] uppercase tracking-wide text-ink-500">Type</span>
        <span className="text-[10px] uppercase tracking-wide text-ink-500">Exposure</span>
        <span />
      </div>

      <div className="flex flex-col">
        {positions.map((position) => {
          const id = key(position);
          const draft = value[id] ?? "";
          const isSaved = (saved[id] ?? "").trim();
          const dirty = draft.trim() !== isSaved;
          const weight = totalSgd > 0 ? position.valueSgd / totalSgd : 0;
          return (
            <form
              key={id}
              onSubmit={(e) => {
                e.preventDefault();
                commit(position, draft);
              }}
              className={ROW}
            >
              <span className="flex items-center">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                  aria-label={`Select ${position.ticker} for a batch tag`}
                  className="h-3.5 w-3.5 accent-accent"
                />
              </span>

              <span className="min-w-[7rem] flex-1 md:min-w-0">
                <span className="num block truncate text-xs text-ink-100" title={position.ticker}>
                  {position.ticker}
                </span>
                <span
                  className="block truncate text-[10px] text-ink-500"
                  title={position.name ?? undefined}
                >
                  {position.name ?? position.region}
                </span>
              </span>

              <span className="num w-24 shrink-0 text-right text-xs text-ink-300 md:w-auto">
                S${formatAmount(position.valueSgd)}
              </span>

              <span
                className="num w-10 shrink-0 text-right text-xs text-ink-500 md:w-auto"
                title={`${(weight * 100).toFixed(2)}% of holdings value`}
              >
                {(weight * 100).toFixed(1)}%
              </span>

              <span
                className="w-16 shrink-0 text-[10px] text-ink-500 md:w-auto"
                title={position.instrumentType ?? "type not reported by the lookup"}
              >
                {typeLabel(position.instrumentType)}
              </span>

              {/* Three resting states, and the point of all three is that a
                  tag reads as a LABEL until you click it: a tag you set (a
                  chip), a tag that is missing (a quiet invitation), or the
                  editor you opened deliberately. There is no permanently
                  visible dark input box, because a box implies something you
                  are expected to keep changing. */}
              <span className="flex min-w-0 basis-full flex-col gap-1 md:basis-auto">
                {editingId === id ? (
                  <TagSelect
                    autoFocus
                    value={draft}
                    options={options}
                    onChange={(next) => setValue((prev) => ({ ...prev, [id]: next }))}
                    onCommit={(next) => {
                      setEditingId(null);
                      commit(position, next);
                    }}
                    onEscape={() => {
                      setValue((prev) => ({ ...prev, [id]: saved[id] ?? "" }));
                      setEditingId(null);
                    }}
                    onBlur={() => settle(position, id)}
                    busy={busy === id}
                    ariaLabel={`Exposure tag for ${position.ticker}`}
                    placeholder="Pick or type a tag…"
                  />
                ) : isSaved ? (
                  <button
                    type="button"
                    onClick={() => setEditingId(id)}
                    className="group/chip flex w-fit max-w-full items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-100 transition hover:border-ink-500 motion-reduce:transition-none"
                    title={`${isSaved} — click to change`}
                  >
                    <span className="truncate">{isSaved}</span>
                    <Pencil
                      size={10}
                      strokeWidth={2}
                      className="shrink-0 text-ink-500 opacity-0 transition group-hover/chip:opacity-100 motion-reduce:transition-none"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingId(id)}
                    className="w-fit text-xs text-ink-500 underline decoration-dotted underline-offset-4 transition hover:text-accent motion-reduce:transition-none"
                  >
                    + Add a tag
                  </button>
                )}
                {/* The draft is offered with the same click that would
                    otherwise have to be typed, and only while there is no tag:
                    once a row is classified, re-offering a draft would be a
                    guess arguing with a decision. */}
                {!isSaved && editingId !== id && position.suggested && (
                  <button
                    type="button"
                    onClick={() => commit(position, position.suggested!, "auto")}
                    className="w-fit text-[10px] text-ink-500 transition hover:text-accent motion-reduce:transition-none"
                    title="Use the suggested tag for this instrument"
                  >
                    + {position.suggested}
                  </button>
                )}
              </span>

              <span className="w-16 shrink-0 text-right md:w-auto">
                {dirty && editingId !== id && (
                  <button
                    type="submit"
                    disabled={busy === id}
                    className="text-xs text-accent transition hover:text-accentHover disabled:text-ink-500 motion-reduce:transition-none"
                  >
                    {busy === id ? "…" : "Save"}
                  </button>
                )}
              </span>
            </form>
          );
        })}
      </div>

      <p className="text-xs text-ink-500">
        {untagged.length === 0
          ? "Every open position is tagged."
          : `${untagged.length} of ${positions.length} untagged — an untagged holding counts as unclassified, never as a guess.`}{" "}
        Two instruments in the same trade should share one tag, so the dropdown reuses a tag across
        holdings. Empty the field and save to untag.
      </p>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
