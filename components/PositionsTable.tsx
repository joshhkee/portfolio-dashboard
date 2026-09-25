"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Percent,
  PlainPercent,
  NativeMoney,
  formatAmount,
  formatQty,
} from "@/components/SignedNumber";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { currencySymbol, currencyForRegion, type Currency } from "@/lib/fx";
import { formatHoldingPeriod } from "@/lib/dates";
import SortableTh from "@/components/SortableTh";
import RegionFlag from "@/components/RegionFlag";
import SearchBox from "@/components/SearchBox";
import TransactionHistoryModal from "@/components/TransactionHistoryModal";
import TickerName from "@/components/TickerName";

export interface PositionRow {
  region: string;
  ticker: string;
  // Descriptive reference data from the ticker-meta cache (see
  // lib/ticker-meta.ts) — display only, never affects the numbers.
  name: string | null;
  qty: number;
  avgCost: number;
  currentPrice: number;
  totalHoldings: number;
  totalHoldingsConverted: number;
  unrealizedPL: number;
  unrealizedPLConverted: number;
  unrealizedPLPct: number;
  portfolioPct: number;
  priceUnavailable: boolean;
  heldSince: Date | null;
}

/** The three markets, in the order the page draws them. */
const REGION_ORDER = ["US", "SG", "HK"];

/**
 * Every figure a header can order the rows by, including the ones that live on a
 * cell's second line.
 *
 * A paired cell is not a hierarchy — "primary, with a companion" — it is two
 * sortable figures sharing a cell, and the header has to be able to say which one
 * is in charge. So the keys are here, `COLUMNS` decides the order a click visits
 * them in, and the header's LABEL changes to name the figure currently doing the
 * ordering ("Value" becomes "Shares"). That label swap is the whole mechanism:
 * it means one control per column, no extra chrome, and no way for a reader to be
 * unsure which of the two numbers produced the order they are looking at.
 */
const GETTERS: Record<string, (r: PositionRow) => number | string> = {
  ticker: (r) => r.ticker,
  totalHoldings: (r) => r.totalHoldings,
  qty: (r) => r.qty,
  currentPrice: (r) => r.currentPrice,
  avgCost: (r) => r.avgCost,
  unrealizedPL: (r) => r.unrealizedPL,
  unrealizedPLPct: (r) => r.unrealizedPLPct,
  portfolioPct: (r) => r.portfolioPct,
  heldSince: (r) => r.heldSince?.getTime() ?? 0,
};

interface SortState {
  key: string;
  dir: "asc" | "desc";
  /** What the header calls itself while this state is active. */
  label: string;
}

/**
 * The columns, and the sort states one click after another visits.
 *
 * Order within a column is `primary ↓ / primary ↑ / secondary ↓ / secondary ↑`,
 * then round again — worth stating because it is what "sort by the second line"
 * costs a reader: two clicks, with the label changing on the third. Descending
 * first for the numeric columns because the biggest holding is the question those
 * headers answer; ascending first for the ticker and for the holding period,
 * where the useful end is the near one.
 *
 * The Holding column has no second state: its companion is the instrument's NAME,
 * which is reference text rather than a figure to rank by, and is null for
 * anything the lookup could not name.
 */
const COLUMNS: {
  id: string;
  label: string;
  title: string;
  states: SortState[];
  align?: "right";
  className?: string;
}[] = [
  {
    id: "holding",
    label: "Holding",
    title: "Ticker, over the instrument's name. Sorted by ticker.",
    states: [
      { key: "ticker", dir: "asc", label: "Holding" },
      { key: "ticker", dir: "desc", label: "Holding" },
    ],
    className: "cell-pad-start",
  },
  {
    id: "value",
    label: "Value",
    title: "Total holdings, over the number of shares. Click again to sort by shares.",
    states: [
      { key: "totalHoldings", dir: "desc", label: "Value" },
      { key: "totalHoldings", dir: "asc", label: "Value" },
      { key: "qty", dir: "desc", label: "Shares" },
      { key: "qty", dir: "asc", label: "Shares" },
    ],
    align: "right",
  },
  {
    id: "price",
    label: "Price",
    title: "Current price, over the average cost paid per share. Click again to sort by average cost.",
    states: [
      { key: "currentPrice", dir: "desc", label: "Price" },
      { key: "currentPrice", dir: "asc", label: "Price" },
      { key: "avgCost", dir: "desc", label: "Avg cost" },
      { key: "avgCost", dir: "asc", label: "Avg cost" },
    ],
    align: "right",
  },
  {
    id: "pl",
    label: "P/L",
    title: "Unrealized profit or loss, over its percentage of average cost. Click again to sort by the percentage.",
    states: [
      { key: "unrealizedPL", dir: "desc", label: "P/L" },
      { key: "unrealizedPL", dir: "asc", label: "P/L" },
      { key: "unrealizedPLPct", dir: "desc", label: "P/L %" },
      { key: "unrealizedPLPct", dir: "asc", label: "P/L %" },
    ],
    align: "right",
  },
  {
    id: "weight",
    label: "Portfolio %",
    title: "This holding's share of the whole portfolio, over how long it has been held. Click again to sort by holding period.",
    states: [
      { key: "portfolioPct", dir: "desc", label: "Portfolio %" },
      { key: "portfolioPct", dir: "asc", label: "Portfolio %" },
      { key: "heldSince", dir: "asc", label: "Held" },
      { key: "heldSince", dir: "desc", label: "Held" },
    ],
    align: "right",
    className: "cell-pad-end",
  },
];

/** The state a table opens in, and the one `COLUMNS` lists first. */
const DEFAULT_SORT: SortState = COLUMNS[1].states[0];

/**
 * Layout for the strip, and for the box the two small tables share.
 *
 * `contents` is doing the work in both of the outer arrangements, and it is why
 * one DOM serves all three: below `min-[1220px]` the track must see THREE
 * siblings (so it can snap one table at a time), and at `min-[1800px]` it must
 * see three COLUMNS — in both cases the wrapper stops generating a box and its
 * children participate in the track's layout directly. Only between those two
 * widths is it a real element: a column holding SG with HK under it.
 */
const PANEL = "w-full min-w-0 shrink-0 snap-start lg:flex lg:min-h-0 lg:flex-col";
const TUCK =
  "contents min-[1220px]:flex min-[1220px]:min-h-0 min-[1220px]:min-w-0 min-[1220px]:flex-1 min-[1220px]:flex-col min-[1220px]:gap-4 min-[1800px]:contents";

/** "245 shares", "1 share", "27.4508 shares" — the word agrees with the
 *  number, and a fractional holding keeps its decimals rather than rounding
 *  into a lie about what is held. */
function shares(qty: number) {
  return `${formatQty(qty)} ${qty === 1 ? "share" : "shares"}`;
}

/**
 * One market's holdings.
 *
 * Each region gets its own table, its own header row and its own sort state,
 * because the point of putting the three side by side is to keep each market a
 * block you can read top to bottom — one table with a `Region` column mixed
 * them together as soon as you sorted by value, which is the opposite of what
 * the comparison needs.
 *
 * Five columns (see `.table-region` in globals.css): ticker/name, value/shares,
 * price/average cost, P/L/percentage, portfolio %/holding period. Every column
 * after the first is a PAIR, and every pair is sortable from its own header —
 * `COLUMNS` above holds the order a click visits them in.
 *
 * The width is the constraint that fixes the set: a table has to fit beside up to
 * two others, and at ~560px per table the 30-day sparkline is the one thing that
 * did not come back. The holding period did — it had no home of its own before,
 * so it rode on the ticker's line, which read as a loose end rather than a fact
 * about the position; paired under the portfolio share it has one.
 */
function RegionTable({
  region,
  rows,
  highlightTicker,
  onSelect,
  searchActive,
}: {
  region: string;
  rows: PositionRow[];
  highlightTicker: string | null;
  onSelect: (row: { region: string; ticker: string; currentPrice: number }) => void;
  searchActive: boolean;
}) {
  /**
   * Sort state, local to this table, cycling through `COLUMNS`.
   *
   * Local on purpose: three tables side by side are three answers to "which of
   * these is biggest", and a sort that reordered all three at once would be one
   * answer pretending to be three.
   */
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const activeId = useMemo(
    () =>
      COLUMNS.find((column) =>
        column.states.some((state) => state.key === sort.key && state.dir === sort.dir)
      )?.id ?? COLUMNS[0].id,
    [sort]
  );

  function advance(column: (typeof COLUMNS)[number]) {
    // From the active state within THIS column to the next one in its list, and
    // from a column that is not active to that column's first state. The lookup
    // returns -1 for an inactive column, so `(-1 + 1) % n` is the first state —
    // the same expression covers both cases rather than needing a branch.
    //
    // Updated from the previous state rather than from the captured one, so
    // clicking a header twice in one tick (a fast double-click, or a keyboard
    // auto-repeat) advances twice instead of landing on the state it was already
    // in — reading `sort` here would make the second click a no-op.
    setSort((previous) => {
      const index = column.states.findIndex(
        (state) => state.key === previous.key && state.dir === previous.dir
      );
      return column.states[(index + 1) % column.states.length];
    });
  }

  const sorted = useMemo(() => {
    const getter = GETTERS[sort.key];
    if (!getter) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  const symbol = currencySymbol[currencyForRegion(region)];
  // Native, not converted: the three headings sit side by side and each names
  // the market it belongs to, so adding them together would be the one thing
  // this row of tables cannot do. The page's own totals above ARE converted.
  const totalNative = rows.reduce((sum, r) => sum + r.totalHoldings, 0);
  const unheld = rows.filter((r) => r.priceUnavailable).length;

  return (
    // `lg:flex-1 lg:min-h-0` here and on the `.table-scroll` below is the whole
    // change of behaviour: the table is as tall as the space its page has left
    // for it and scrolls its own rows, instead of growing to its content and
    // dragging the page (and, in the tuck layout, the table beside it) taller.
    <section className="flex min-w-0 flex-col gap-2 lg:min-h-0 lg:flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        {/* The flag is a landmark, not a label: it sits beside the region code
            and the code keeps saying which market this is, so the market is
            never carried by a 16px picture alone. */}
        <p className="flex items-center gap-2 text-sm text-ink-100">
          <RegionFlag region={region} />
          <span>
            {region}
            <span className="text-ink-300">
              {" "}
              · {rows.length} {rows.length === 1 ? "holding" : "holdings"}
              {/* "at cost" is the one caveat that changes how the heading's figure
                  should be read, so it is stated on the heading rather than only
                  in the row — and the clause that used to be a paragraph under
                  the search box lives on the phrase itself now, where the
                  reader is already looking. */}
              {unheld > 0 ? (
                <span
                  title={`${unheld} of these rows have no live quote: they are held at cost and show N/A for P/L, so this market's total understates the true figure.`}
                >{` · ${unheld} at cost`}</span>
              ) : (
                ""
              )}
            </span>
          </span>
        </p>
        <p className="num text-xs text-ink-300" title={`${region} holdings, in ${currencyForRegion(region)}`}>
          {symbol}
          {formatAmount(totalNative)}
        </p>
      </div>

      <div className="table-scroll">
        <table className="ledger-table table-region">
          <thead>
            <tr>
              {/* The first and last columns carry the padding classes: the
                  ledger's own px-2 leaves a name and a figure sitting right on
                  the table's edge, and a utility cannot fix it (see the class
                  in globals.css).

                  Each header's label follows the state it is in, so a column
                  sorting by its second figure says so. */}
              {COLUMNS.map((column) => {
                const isActive = activeId === column.id;
                // Where in this column's cycle the table currently is. The dots
                // read the SAME states array the click advances through, so the
                // count and the label can never disagree with what a click does
                // — there is no second list to keep in step.
                const at = isActive
                  ? column.states.findIndex(
                      (state) => state.key === sort.key && state.dir === sort.dir
                    )
                  : -1;
                return (
                  <SortableTh
                    key={column.id}
                    label={isActive ? sort.label : column.label}
                    title={column.title}
                    active={isActive}
                    direction={sort.dir}
                    onClick={() => advance(column)}
                    align={column.align}
                    className={column.className}
                    level={at >= 0 ? { index: at, count: column.states.length } : undefined}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isHit =
                highlightTicker !== null &&
                r.ticker.toLowerCase() === highlightTicker.toLowerCase();
              return (
                <tr
                  key={`${r.region}-${r.ticker}`}
                  id={isHit ? "highlighted-holding" : undefined}
                  className={`cursor-pointer ${isHit ? "bg-accent/10 ring-1 ring-inset ring-accent/40" : ""}`}
                  onClick={() =>
                    onSelect({ region: r.region, ticker: r.ticker, currentPrice: r.currentPrice })
                  }
                  title="View transaction history"
                >
                  <td className="cell-pad-start">
                    {/* Ticker over name, two lines, and nothing riding on the
                        ticker any more: the holding period used to sit at this
                        line's right end and read as detached from the row's
                        figures ("looks unnatural"). It has a column of its own
                        now, paired with a figure that is about the position
                        rather than about the instrument. */}
                    <span className="num block text-ink-100">
                      {r.ticker}
                      {r.priceUnavailable && (
                        <TriangleAlert
                          size={12}
                          className="ml-1 inline text-ink-500"
                          aria-label="No live quote available for this ticker — price/P&L shown may be stale"
                        />
                      )}
                    </span>
                    {/* Smaller than the ledger's subtitle: this name has five
                        columns of room, not eleven. */}
                    <TickerName
                      region={r.region}
                      ticker={r.ticker}
                      name={r.name}
                      maxWidthClass="max-w-[9rem]"
                    />
                  </td>

                  {/* Value, over the shares that make it up. All three paired
                      cells are built the same way — primary on the row's text
                      size, companion at text-xs in ink-500, both right-aligned
                      — so a row reads as pairs of figures. */}
                  <td className="num text-right">
                    <span className="block">
                      {symbol}
                      {formatAmount(r.totalHoldings)}
                    </span>
                    <span className="block text-xs text-ink-500">{shares(r.qty)}</span>
                  </td>

                  <td className="num text-right">
                    <span className="block">
                      {r.priceUnavailable ? (
                        <span className="text-ink-500" title="No live quote available">
                          —
                        </span>
                      ) : (
                        <>
                          {symbol}
                          {formatAmount(r.currentPrice)}
                        </>
                      )}
                    </span>
                    {/* No "avg" label: the header's hover says which of the two
                        figures is which, and the pair reads the same way in
                        every row. Both are quantities, so neither is coloured. */}
                    <span className="block text-xs text-ink-500" title="Average cost paid per share.">
                      {symbol}
                      {formatAmount(r.avgCost)}
                    </span>
                  </td>

                  <td className="text-right">
                    {r.priceUnavailable ? (
                      <span className="text-ink-500" title="No live quote — can't compute unrealized P/L">
                        N/A
                      </span>
                    ) : (
                      <>
                        <span className="block">
                          <NativeMoney value={r.unrealizedPL} symbol={symbol} showPlus />
                        </span>
                        <span className="block text-xs">
                          <Percent value={r.unrealizedPLPct} />
                        </span>
                      </>
                    )}
                  </td>

                  {/* Share of the whole portfolio, over the holding period.
                      The pair is the one the review asked for — the two facts
                      that are about the position rather than about the price —
                      and the share is neutral (a quantity, not a result, §2). */}
                  <td className="num cell-pad-end text-right">
                    <span className="block">
                      <PlainPercent value={r.portfolioPct} />
                    </span>
                    <span
                      className="block text-xs text-ink-500"
                      title="How long this position has been held."
                    >
                      {r.heldSince ? formatHoldingPeriod(r.heldSince) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-300">
                  {searchActive && rows.length === 0
                    ? "No holdings match your search."
                    : "No holdings in this market right now."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * The holdings pages: every market, each its own table, side by side.
 *
 * This was three routes with one page each, then (for one pass) a single table
 * with a `Region` column. The owner's correction — "I still want separate tables
 * for each region, just placed side by side" — names the real requirement: the
 * regions have to be comparable IN PLACE, and a single table loses that the
 * moment you sort it by value, because US, SG and HK then interleave.
 *
 * Three tables do not always fit, and the owner's preference for what to do about
 * that is explicit — show the market rather than hide it behind an arrow. So the
 * arrangements, in order, are:
 *
 *   3 across        viewport >= ~1800px   (three columns, five-column tables)
 *   2 across + tuck viewport >= ~1220px   (US | SG with HK under it, no arrows)
 *   1 across        below that            (the strip and its arrows)
 *
 * The thresholds come from the column floor (~560px for five columns: the figures
 * are 269px, the ticker 156px, `Portfolio %` 66px, plus the 12px outer padding),
 * not from taste. The tuck's price is visible in that layout and worth stating:
 * US is capped at 70vh while SG + HK total a few hundred pixels, so the right
 * column ends short.
 *
 * The strip scrolls natively (keyboard arrows work on the focused region), snaps
 * one table at a time, and honours `prefers-reduced-motion` by jumping instead of
 * sliding. A `?ticker=` deep link still lands correctly: the row's own table is
 * slid into view before the row itself is centred, and in the two- and
 * three-column layouts there is nothing to slide because everything is visible.
 */
export default function PositionsTable({
  rows,
  displayCurrency = "SGD",
}: {
  rows: PositionRow[];
  displayCurrency?: Currency;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    region: string;
    ticker: string;
    currentPrice: number;
  } | null>(null);

  // The command palette navigates here with ?ticker=… to "jump to" a holding,
  // so that row is highlighted and scrolled into view on arrival.
  const searchParams = useSearchParams();
  const highlightTicker = searchParams.get("ticker");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [arrows, setArrows] = useState({ prev: false, next: false });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.ticker.toLowerCase().includes(q) || r.region.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const groups = useMemo(
    () => REGION_ORDER.map((region) => ({ region, rows: filtered.filter((r) => r.region === region) })),
    [filtered]
  );

  // One search box for all three tables: three fields would be three places to
  // type the same ticker into. A region that ends up with nothing says so.
  const searching = search.trim().length > 0;
  const rowsOf = (region: string) => groups.find((group) => group.region === region)?.rows ?? [];

  /**
   * Whether there is anything to slide to. The arrows are derived from the
   * scroll position rather than from the breakpoint, so they cannot disagree
   * with what is actually on screen — including the case where a search has
   * emptied a table and made the others fit.
   */
  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setArrows({
      prev: el.scrollLeft > 2,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const observer = new ResizeObserver(syncArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      observer.disconnect();
    };
  }, [syncArrows, groups]);

  function slide(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const step = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
    // The gap between panels, so one press advances exactly one table.
    const gap = 16;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * (step + gap), behavior: reduce ? "auto" : "smooth" });
  }

  // Declared after the tables so the node exists: bring the row's OWN table into
  // view first (a ticker lives in exactly one market's table), then centre the
  // row vertically. Reduced motion still moves, it just arrives instantly.
  useEffect(() => {
    if (!highlightTicker) return;
    const node = document.getElementById("highlighted-holding") as HTMLTableRowElement | null;
    const track = trackRef.current;
    if (!node || !track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = node.closest<HTMLElement>("[data-region-panel]");
    if (panel) {
      const left = panel.offsetLeft - track.offsetLeft;
      const visible =
        track.scrollLeft <= left && track.scrollLeft + track.clientWidth >= left + panel.offsetWidth;
      if (!visible) {
        track.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
      }
    }
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [highlightTicker, groups]);

  const displaySymbol = currencySymbol[displayCurrency];
  const totalValueConverted = rows.reduce((sum, r) => sum + r.totalHoldingsConverted, 0);
  const totalPLConverted = rows.reduce((sum, r) => sum + r.unrealizedPLConverted, 0);
  const anyPriceUnavailable = rows.some((r) => r.priceUnavailable);

  const showArrows = arrows.prev || arrows.next;

  return (
    <div className="screen">
      {/* One band of chrome, not four.

          This page used to spend, above its first row of data: a stat row on
          two lines (~70px), a sentence explaining that the three tables are in
          three currencies (~32px), a conditional sentence about missing quotes
          (~32px), and a full-width search field on a line of its own (~40px)
          plus gaps between each — about 240px of a 900px window explaining
          itself to a reader who owns all three markets.

          The figures are now ON one line (a `dl`, so they stay a labelled
          pair), the sentences are gone from the page and back on the labels
          they qualify — where a reader asks the question instead of reading a
          paragraph on arrival (DESIGN.md §8.6) — and the filter shares the row
          with them. That band is what the tables now get: three markets, each
          several hundred pixels tall, instead of a taller header above a
          shorter table. */}
      <div className="page-bar">
        <dl className="stat-strip">
          <div className="flex items-baseline gap-2">
            <dt title={`US and HK holdings converted to ${displayCurrency} at today's rate; each region's own total stays in its market's currency.`}>
              Total holdings ({displayCurrency})
            </dt>
            <dd>
              {displaySymbol}
              {formatAmount(totalValueConverted)}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt title={`Unrealized P/L converted to ${displayCurrency} at today's rate.${anyPriceUnavailable ? " Rows with no live quote are held at cost, so this understates the real figure." : ""}`}>
              Unrealized P/L ({displayCurrency})
            </dt>
            <dd>
              <NativeMoney value={totalPLConverted} symbol={displaySymbol} showPlus />
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2">
          {showArrows && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => slide(-1)}
                disabled={!arrows.prev}
                aria-label="Previous market"
                className="rounded-md border border-ink-700 p-1 text-ink-300 transition hover:border-ink-500 hover:text-ink-100 disabled:cursor-not-allowed disabled:text-ink-500 disabled:opacity-50 motion-reduce:transition-none"
              >
                <ChevronLeft size={15} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => slide(1)}
                disabled={!arrows.next}
                aria-label="Next market"
                className="rounded-md border border-ink-700 p-1 text-ink-300 transition hover:border-ink-500 hover:text-ink-100 disabled:cursor-not-allowed disabled:text-ink-500 disabled:opacity-50 motion-reduce:transition-none"
              >
                <ChevronRight size={15} strokeWidth={1.75} />
              </button>
            </div>
          )}
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search ticker or region…"
          />
        </div>
      </div>

      {/* The scroll container owns both axes, like `.table-scroll`, so the list
          cannot drag the page sideways — and it only DOES scroll in the one-column
          case, because above `min-[1220px]` the panels are `flex-1` and share the
          width instead of overflowing. That is also why the arrows need no
          breakpoint of their own: they are driven by the scroll position, so they
          appear exactly where the track scrolls.

          Two arrangements above one column, and the order between them is the
          owner's: prefer SHOWING a market to hiding it behind an arrow. So from
          `min-[1220px]` the three tables become two columns — US alone in the
          first, SG with HK tucked under it in the second (the wrapper) — and three
          across only from `min-[1800px]`, where a five-column table still has its
          ~560px. The cost of the tuck is stated rather than hidden: US is capped
          at 70vh while SG + HK come to a few hundred pixels, so the second column
          ends short and the page is as tall as its tallest table. */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-label="Holdings by market"
        className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent lg:min-h-0 lg:flex-1"
      >
        {/* Written out rather than mapped, because the second column is two
            tables in one box and the DOM order is what both other layouts rely
            on: in the strip (below `min-[1220px]`) the wrapper is `contents`, so
            the track sees US, SG, HK as siblings in that order and slides one at
            a time; at three-across the wrapper is `contents` again and they are
            three equal columns. Only between those two widths is it a box. */}
        <div data-region-panel="" className={`${PANEL} min-[1220px]:w-auto min-[1220px]:flex-1`}>
          <RegionTable
            region="US"
            rows={rowsOf("US")}
            highlightTicker={highlightTicker}
            onSelect={setSelected}
            searchActive={searching}
          />
        </div>
        <div className={TUCK}>
          {["SG", "HK"].map((region) => (
            // `min-[1220px]:flex-1` is the width in the two-across row and the
            // HEIGHT in the tucked column, which is why SG and HK now share the
            // right-hand column's full height between them rather than ending
            // short under a 70vh-capped US table — the cap is gone with the rest
            // of the page's viewport arithmetic.
            <div
              key={region}
              data-region-panel=""
              className={`${PANEL} min-[1220px]:min-h-0 min-[1220px]:flex-1 min-[1800px]:w-auto`}
            >
              <RegionTable
                region={region}
                rows={rowsOf(region)}
                highlightTicker={highlightTicker}
                onSelect={setSelected}
                searchActive={searching}
              />
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <TransactionHistoryModal
          region={selected.region}
          ticker={selected.ticker}
          currentPrice={selected.currentPrice}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
