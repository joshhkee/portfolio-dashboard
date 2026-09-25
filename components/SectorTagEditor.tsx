"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * drift: instrument, value, weight, type, tag control, action.
 *
 * It is a FLEX row below `md` and a grid above it. Six columns on a phone is a
 * horizontal scrollbar for nothing, so there the cells wrap into two lines
 * instead — ticker with its type label, and the value; then the weight bar with
 * the tag chip after it. `flex-1` has no meaning inside a grid, which is what
 * lets one element list carry both layouts.
 *
 * That mobile arrangement is the second pass. At 356px the row read as four
 * loose lines per holding: the type label floated in the middle of the first
 * line, because it is `ml-auto` inside an 11rem COLUMN on a desktop and a phone
 * has no column for it to align to, so it hung in the gap between the ticker and
 * the value; and the tag chip took a line of its own for ~90px of content. Now
 * the type sits against the ticker, where its alignment means nothing because
 * there is nothing to align with, and the chip rides the line the weight bar is
 * already on. Two lines per holding, each one a pair that belongs together.
 *
 * The TWO-UP threshold is `min-[1820px]` rather than `xl`, and that is not
 * taste — it is the exposure page's geometry. From 1280px up this list sits in
 * the right-hand column, beside a 32rem column of donuts, so its own width is
 * `viewport - 607px` (32rem + the 1rem gutter + the page's 2rem of padding per
 * side). Two holdings per line need 1208px of panel — two 560px templates plus
 * the 20px rule and padding between them — and `viewport - 607 = 1208` lands at
 * 1815px. A viewport breakpoint standing in for a container measurement is a
 * compromise (the honest tool would be a container query, which this Tailwind
 * build does not emit: `@container`/`@[35rem]:` compile to nothing here, checked
 * with the CLI against these exact classes). What it costs is a dependency: if
 * the exposure page's columns change width, this number has to move with them.
 * What it buys is not squeezing each half to 300px at a 1280px window, which is
 * what the old `xl:` did the moment the list stopped spanning the page.
 *
 * There is no selection column any more. Tagging used to be batched by ticking
 * rows, which cost a leading 1.5rem column plus a toolbar of Select all /
 * Select untagged / Apply-to-N controls — a lot of chrome for a list of labels
 * whose whole point is that you set each one once. The only batch left is
 * accepting the classifier's drafts, which is one button.
 *
 * Three earlier versions of this template are worth knowing about, because all
 * three looked reasonable in the code and wrong on the screen. First the
 * instrument column was `1fr`: in a 1230px panel it grew to ~690px, so a row read
 * "name ……… S$19,061.00" with a hand-span of empty space between the two.
 * Capping it at 20rem fixed that, but it moved the void to the END of the row —
 * the tag column had the `1fr`, so every row finished with a chip and then
 * several hundred pixels of nothing.
 *
 * The slack went to the WEIGHT column then, where it is spent on something: the
 * list is ordered biggest holding first, and a bar compares down a column in a
 * way that "30.7%" does not. The instrument cap came down with it (20rem ->
 * 11rem), because the cap's job is only to stop a long name setting the column,
 * and this row is now half a panel wide rather than all of it.
 *
 * The third change is the row itself: TWO holdings per line on a wide screen
 * (see the rows container in the component), because eighteen one-per-line rows were
 * spending the panel's full width on a bar and its height on nothing. Type moved
 * out of its own column and onto the ticker's line to pay for it — it was a
 * single word in a 4rem column, and it still costs no line of its own there.
 *
 * The tag column is a fixed 11rem for the same reason it used to be `1fr`: the
 * rows are separate grids, so a content-sized column would start each chip at a
 * different x and the column would stop reading as a column. A fixed width also
 * bounds the tag cell, which is what keeps the chip off the action column — and
 * the action column is `auto`, not a fixed 4.5rem, because it holds a Save
 * button that only exists on a row being edited. Reserving width for a control
 * that is absent is the same void in a new place; it is the LAST column, so
 * letting it size to nothing cannot misalign anything before it.
 *
 * Gold for the bar is the app's proportion colour, not a highlight — see
 * docs/DESIGN.md §2, where the holding-value and outlay bars are the same gold
 * on the same track.
 *
 * The five tracks want **560px** before a row can be a grid at all: 11rem
 * instrument, 5.5rem value, a 1fr weight column that needs about 7rem once the
 * bar and its figure are inside it, 11rem tag, and 12px between each. `md`
 * (768px) is comfortably below that whenever the panel spans the page, which is
 * the arrangement it was written for — and in the exposure page's right-hand
 * column the panel is ~660px at its narrowest, which is still over the line.
 */
const TEMPLATE =
  "md:grid-cols-[minmax(0,11rem)_5.5rem_minmax(4rem,1fr)_11rem_minmax(0,auto)]";

const ROW = `flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700 py-2.5 md:grid ${TEMPLATE}`;

const HEAD = `gap-x-3 border-b border-ink-700 pb-1.5 ${TEMPLATE}`;

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
 *    "+ Financials" is a button on the untagged row, and one batch action
 *    accepts every draft. It is stated on that one clickable line and nowhere
 *    else, so an empty field never looks filled in.
 *
 * Deliberately not a fixed single-select: an untagged instrument stays visibly
 * untagged rather than defaulting into a bucket nobody chose.
 *
 * The control is a chip, not a field. A tag is set once and then read for
 * years, so the row rests as a label you can click — a permanently visible
 * input would say "this needs maintaining" about something that does not.
 *
 * Grouping is therefore done by TAG, not by multi-selecting rows: two
 * instruments in the same trade are given the same tag one after the other
 * (D05 and XLF are one trade), which is the same outcome without a checkbox
 * column and a toolbar standing next to a list of labels.
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
  const [error, setError] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLFormElement | null>>({});

  /**
   * Bring the row being edited into the middle of the list.
   *
   * From `xl` the rows scroll inside their panel (the exposure page gives that
   * panel a fixed height so the page itself does not scroll), and the tag
   * dropdown opens BELOW its row — so opening an editor near the bottom of the
   * scroll area would put most of the popup outside it, where a scroll container
   * clips it. Centring the row first leaves a popup's height of room under it.
   *
   * Guarded on the container actually scrolling: below `xl` there is no such
   * container, and jumping the page to centre a row the reader has just tapped
   * would be noise.
   */
  useEffect(() => {
    if (!editingId) return;
    const node = rowRefs.current[editingId];
    const scroller = node?.closest<HTMLElement>("[data-tag-scroll]");
    if (!node || !scroller) return;
    if (scroller.scrollHeight <= scroller.clientHeight + 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [editingId]);

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
   * is "manual" would make the stored source mean "which button did I press".
   */
  async function commit(row: TaggablePosition, next: string, src: "auto" | "manual" = "manual") {
    const ok = await write(row, next, src);
    if (ok) router.refresh();
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
    router.refresh();
  }

  if (positions.length === 0) {
    return <p className="text-sm text-ink-300">No open positions to tag.</p>;
  }

  const untagged = positions.filter((p) => !saved[key(p)]?.trim());
  const suggestedRows = untagged.filter((p) => !!p.suggested);

  return (
    /* `xl:flex-1 min-h-0` is the page's contract with this component: the
       exposure page hands the panel a fixed height from `xl` up, and this list
       fills what is left of it after its own chrome. Below that it is an
       ordinary block, sized by its rows, and the page scrolls. */
    <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
      {/* One line, and one action: how much is left to tag, and the offer to
          take the classifier's drafts. Everything else this bar used to hold
          was batch-selection machinery. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-700 bg-ink-850 px-3 py-2">
        <span className="text-xs text-ink-300">
          {untagged.length} of {positions.length} untagged
        </span>

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

      {/* Two label rows once there are two rows of holdings per line: each half
          is a self-contained grid with the same template, so repeating the
          labels over each half is what keeps them aligned with their own
          figures. Narrower than two-up, the second set is hidden and the first
          spans the panel, matching the single column of rows. */}
      <div className="hidden md:grid md:grid-cols-1 min-[1820px]:grid-cols-2">
        <div className={`grid ${HEAD} min-[1820px]:pr-5`}>
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Instrument</span>
          <span className="text-right text-[10px] uppercase tracking-wide text-ink-500">Value</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Weight</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Exposure</span>
          <span />
        </div>
        <div
          aria-hidden
          className={`hidden min-[1820px]:grid min-[1820px]:border-l min-[1820px]:border-ink-700/50 min-[1820px]:pl-5 ${HEAD}`}
        >
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Instrument</span>
          <span className="text-right text-[10px] uppercase tracking-wide text-ink-500">Value</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Weight</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Exposure</span>
          <span />
        </div>
      </div>

      {/* Two per line on a wide screen (the `1820` in TEMPLATE's note above is
          why): the odd/even classes split each visual line
          down the middle and draw the rule between the halves, so the panel
          halves its height without the two rows reading as one wide row. The
          odd/even padding is equal (20px each), which is what keeps the two
          halves the same width — and therefore their figures in line. */}
      {/* The one thing on this page that grows with the portfolio, so it is the
          one thing that scrolls: bounded by the panel from `xl`, and scrolling
          under its own label row, which stays put so a column of figures never
          loses the heading above it. `data-tag-scroll` is what the row-centring
          effect above looks for. */}
      <div
        data-tag-scroll=""
        className="flex flex-col min-[1820px]:grid min-[1820px]:grid-cols-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto"
      >
        {positions.map((position, index) => {
          const id = key(position);
          const draft = value[id] ?? "";
          const isSaved = (saved[id] ?? "").trim();
          const dirty = draft.trim() !== isSaved;
          const weight = totalSgd > 0 ? position.valueSgd / totalSgd : 0;
          return (
            <form
              key={id}
              ref={(el) => {
                rowRefs.current[id] = el;
              }}
              onSubmit={(e) => {
                e.preventDefault();
                commit(position, draft);
              }}
              className={`${ROW} ${
                index % 2 === 0
                  ? "min-[1820px]:pr-5"
                  : "min-[1820px]:border-l min-[1820px]:border-ink-700/50 min-[1820px]:pl-5"
              }`}
            >
              <span className="min-w-[7rem] flex-1 md:min-w-0">
                {/* Type rides the ticker's line rather than holding a column: one
                    word ("Stock", "Fund", or a dash when the lookup said nothing)
                    against the right edge of the instrument cell, in the same
                    10px ink-500 the retired Type column used. */}
                <span className="flex items-baseline gap-2">
                  <span className="num block truncate text-xs text-ink-100" title={position.ticker}>
                    {position.ticker}
                  </span>
                  <span
                    className="shrink-0 text-[10px] text-ink-500 md:ml-auto"
                    title={position.instrumentType ?? "type not reported by the lookup"}
                  >
                    {typeLabel(position.instrumentType)}
                  </span>
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

              {/* The weight as a length and as a figure. The bar is the cell
                  that takes the panel's leftover width, so the room that used
                  to sit empty after a chip is now the one thing on the page
                  that ranks the holdings against each other. The number keeps
                  its exact place at the bar's end, so a bar too short to read
                  still has its value beside it. No color coding: a share of
                  the portfolio is a quantity, not a result (docs/DESIGN.md §2).

                  The track is `ink-700` rather than the `ink-800` the shorter
                  bars in this app use (RiskPanel, AllocationCards,
                  ContributionAttribution). Those sit beside their label at a
                  fixed few-rem width, so the label supplies the scale; this one
                  is the width of the panel, and at `ink-800` it was invisible
                  against the panel — 18 rows of a gold tick floating in
                  nothing, which is the empty space this pass set out to use.

                  `w-24` on a phone and `w-auto` (i.e. the grid track) once the
                  row is a grid: full width there would have pushed Type onto a
                  line of its own, one extra line per row on the one layout that
                  can least afford it, so the bar shares that line instead. */}
              <span className="flex w-24 shrink-0 items-center gap-2 md:w-auto">
                <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span
                    className="block h-full rounded-full bg-accent/70"
                    style={{ width: `${Math.min(Math.max(weight, 0), 1) * 100}%` }}
                  />
                </span>
                <span
                  className="num w-10 shrink-0 text-right text-xs text-ink-500"
                  title={`${(weight * 100).toFixed(2)}% of holdings value`}
                >
                  {(weight * 100).toFixed(1)}%
                </span>
              </span>

              {/* Three resting states, and the point of all three is that a
                  tag reads as a LABEL until you click it: a tag you set (a
                  chip), a tag that is missing (a quiet invitation), or the
                  editor you opened deliberately. There is no permanently
                  visible dark input box, because a box implies something you
                  are expected to keep changing. */}
              <span className="flex min-w-0 flex-col gap-1">
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
                    /* Five options rather than eight: the popup has to fit under
                       a row inside a bounded list, and a scroll container
                       clips what hangs out of it. The rest are a scroll away,
                       in a list that was already scrollable. */
                    maxVisible={5}
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
