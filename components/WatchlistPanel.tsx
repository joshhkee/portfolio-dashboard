"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Pencil, ChevronRight, ChevronDown, SlidersHorizontal } from "lucide-react";
import { currencySymbol, currencyForRegion, type FxRates } from "@/lib/fx";
import { priceKey } from "@/lib/prices";
import { PlainMoney, Percent, formatAmount } from "@/components/SignedNumber";
import Sparkline from "@/components/Sparkline";
import TickerName from "@/components/TickerName";
import RangeBar, { rangePositionLabel } from "@/components/RangeBar";
import RegionFlag from "@/components/RegionFlag";
import WatchlistSignals from "@/components/WatchlistSignals";
import PositionSizingCalculator from "@/components/PositionSizingCalculator";
import type { WatchlistRow } from "@/lib/watchlist";
import type { EntrySeries, EntrySignals } from "@/lib/entry-signals";

export default function WatchlistPanel({
  initialRows,
  portfolioTotalSgd = 0,
  fxRates = { SGD: 1.35, HKD: 7.8 },
}: {
  initialRows: WatchlistRow[];
  portfolioTotalSgd?: number;
  fxRates?: FxRates;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<WatchlistRow[]>(initialRows);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [signals, setSignals] = useState<Record<string, EntrySignals> | null>(null);
  const [entrySeries, setEntrySeries] = useState<Record<string, EntrySeries>>({});

  // 30-day sparkline trends
  const [trends, setTrends] = useState<Record<string, number[]>>({});
  const keyList = useMemo(
    () => rows.map((r) => priceKey(r.region, r.ticker)),
    [rows]
  );
  const trendKeys = useMemo(() => keyList.join(","), [keyList]);

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

  // Entry signals from 1-year closes
  useEffect(() => {
    if (!trendKeys) return;
    let cancelled = false;
    fetch(`/api/watchlist/signals?keys=${encodeURIComponent(trendKeys)}`)
      .then((res) => (res.ok ? res.json() : { signals: {}, series: {} }))
      .then((data) => {
        if (cancelled) return;
        setSignals(data.signals ?? {});
        setEntrySeries(data.series ?? {});
      })
      .catch(() => {
        if (!cancelled) {
          setSignals({});
          setEntrySeries({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trendKeys]);

  // Poll refresh every 60s
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/watchlist");
        if (!res.ok) return;
        const data = await res.json();
        setRows((current) => {
          const openNote = current.find((r) => r.id === editingNote);
          const next: WatchlistRow[] = data.items;
          return openNote
            ? next.map((r) => (r.id === openNote.id ? { ...r, notes: openNote.notes } : r))
            : next;
        });
        setRefreshedAt(new Date().toLocaleTimeString());
      } catch {
        // ignore transient error
      }
    }
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [editingNote]);

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
          targetBuyPrice: form.get("targetBuyPrice"),
          targetAllocPct: form.get("targetAllocPct"),
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

  async function saveNote(id: number, notes: string) {
    const clean = notes.trim();
    setRows((current) => current.map((r) => (r.id === id ? { ...r, notes: clean || null } : r)));
    setEditingNote(null);
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, notes: clean || null }),
    }).catch(() => null);
    router.refresh();
  }

  async function saveTarget(id: number, targetBuyPrice: number | null, targetAllocPct: number | null) {
    setRows((current) =>
      current.map((r) => {
        if (r.id !== id) return r;
        const targetProximityPct =
          r.price !== null && targetBuyPrice !== null && targetBuyPrice > 0
            ? (r.price - targetBuyPrice) / targetBuyPrice
            : null;
        return {
          ...r,
          targetBuyPrice,
          targetAllocPct,
          targetProximityPct,
        };
      })
    );
    setEditingTarget(null);
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, targetBuyPrice, targetAllocPct }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {refreshedAt ? `Quotes refreshed ${refreshedAt}` : "Prices and changes update each minute"}
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-ghost-sm flex items-center gap-1.5">
            <Plus size={13} strokeWidth={2.5} />
            Track a ticker
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="panel flex flex-wrap items-end gap-3 p-4">
          <div className="flex w-24 flex-col gap-1">
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
          <div className="flex w-32 flex-col gap-1">
            <label className="text-xs text-ink-300">Target Buy</label>
            <input
              name="targetBuyPrice"
              type="number"
              step="0.01"
              min="0"
              className="field font-mono"
              placeholder="e.g. 115.00"
            />
          </div>
          <div className="flex w-28 flex-col gap-1">
            <label className="text-xs text-ink-300">Target Alloc</label>
            <input
              name="targetAllocPct"
              type="number"
              step="0.01"
              min="0"
              max="1"
              className="field font-mono"
              placeholder="e.g. 0.05"
              title="Weight as a fraction, e.g. 0.05 for 5%"
            />
          </div>
          <div className="flex w-64 flex-col gap-1">
            <label className="text-xs text-ink-300">Thesis / Why</label>
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

      {/* Main Watchlist Container */}
      <div className="panel min-h-0 overflow-auto lg:flex-1">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-300">
            Nothing on the watchlist yet. Track a ticker you are considering buying.
          </p>
        ) : (
          <>
            {/* Desktop Table (>= md) with 3-tier progressive disclosure */}
            <table className="ledger-table table-compact table-fixed hidden md:table">
              <thead>
                <tr>
                  <th className="cell-pad-start w-6" />
                  <th className="w-[18rem]">Ticker</th>
                  <th className="w-[8rem] text-right">Price / Target</th>
                  <th className="w-[6rem] text-right">Today</th>
                  <th
                    className="w-[8.5rem] text-right"
                    title="Distance from target entry price: (Current - Target) / Target"
                  >
                    Target Proximity
                  </th>
                  <th
                    className="hidden w-[7rem] text-right lg:table-cell"
                    title="Where the price sits between its 1-year low and high"
                  >
                    1y range
                  </th>
                  <th
                    className="hidden w-[6rem] text-right xl:table-cell"
                    title="Price trend over the last 30 days"
                  >
                    30d
                  </th>
                  <th className="hidden md:table-cell">Why</th>
                  <th className="cell-pad-end w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const symbol = currencySymbol[currencyForRegion(r.region)];
                  const key = priceKey(r.region, r.ticker);
                  const signal = signals?.[key] ?? null;
                  const isOpen = expanded === r.id;
                  const hasTarget = r.targetBuyPrice !== null && r.targetBuyPrice > 0;
                  const atOrBelow = r.targetProximityPct !== null && r.targetProximityPct <= 0;
                  const nearTarget =
                    r.targetProximityPct !== null &&
                    r.targetProximityPct > 0 &&
                    r.targetProximityPct <= 0.05;

                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-ink-850/40 transition-colors">
                        <td className="cell-pad-start pr-0">
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : r.id)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Hide" : "Show"} deep dive for ${r.ticker}`}
                            title={isOpen ? "Hide deep dive" : "Show deep dive & sizing"}
                            className="text-ink-500 transition hover:text-ink-100"
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        {/* Tier 1 + Tier 2: Ticker + Region + Name */}
                        <td>
                          <span className="flex items-baseline gap-2">
                            <span className="num font-semibold text-ink-100">{r.ticker}</span>
                            <RegionFlag region={r.region} />
                          </span>
                          <TickerName
                            region={r.region}
                            ticker={r.ticker}
                            name={r.name}
                            maxWidthClass="max-w-[10rem] sm:max-w-[18rem]"
                          />
                        </td>

                        {/* Tier 1 + Tier 2: Price over Target */}
                        <td className="num text-right">
                          <span className="block text-ink-100 font-medium">
                            {r.price !== null ? (
                              <PlainMoney value={r.price} symbol={symbol} />
                            ) : (
                              <span className="text-ink-500">—</span>
                            )}
                          </span>
                          <span className="block text-[11px] text-ink-500">
                            {hasTarget ? (
                              `target ${symbol}${formatAmount(r.targetBuyPrice!)}`
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTarget(r.id);
                                  setExpanded(r.id);
                                }}
                                className="text-ink-500 hover:text-accent"
                              >
                                + set target
                              </button>
                            )}
                          </span>
                        </td>

                        {/* Session move */}
                        <td className="num text-right">
                          {r.dayChangePct !== null ? (
                            <Percent value={r.dayChangePct} />
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </td>

                        {/* Tier 1 Target Proximity Pill */}
                        <td className="text-right">
                          {hasTarget && r.targetProximityPct !== null ? (
                            atOrBelow ? (
                              <span
                                className="inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent"
                                title={`At or below target by ${(Math.abs(r.targetProximityPct) * 100).toFixed(1)}%`}
                              >
                                At Target
                              </span>
                            ) : nearTarget ? (
                              <span
                                className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                                title={`${(r.targetProximityPct * 100).toFixed(1)}% above target`}
                              >
                                +{(r.targetProximityPct * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span
                                className="num text-xs text-ink-500"
                                title={`${(r.targetProximityPct * 100).toFixed(1)}% above target`}
                              >
                                +{(r.targetProximityPct * 100).toFixed(1)}%
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-ink-600">—</span>
                          )}
                        </td>

                        {/* 1y range bar */}
                        <td className="hidden text-right lg:table-cell">
                          {signal?.rangePosition != null &&
                          signal.rangeLow !== null &&
                          signal.rangeHigh !== null ? (
                            <RangeBar
                              position={signal.rangePosition}
                              label={`${rangePositionLabel(signal.rangePosition)} — ${symbol}${signal.rangeLow.toFixed(2)} to ${symbol}${signal.rangeHigh.toFixed(2)}`}
                            />
                          ) : signal ? (
                            <span className="text-xs text-ink-500">—</span>
                          ) : (
                            <span className="text-xs text-ink-500">…</span>
                          )}
                        </td>

                        {/* 30d sparkline */}
                        <td className="hidden xl:table-cell">
                          {trends[key] ? (
                            <Sparkline values={trends[key]} />
                          ) : (
                            <span className="text-xs text-ink-500">—</span>
                          )}
                        </td>

                        {/* Why / Notes */}
                        <td className="hidden max-w-[18rem] md:table-cell">
                          {editingNote === r.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                saveNote(
                                  r.id,
                                  String(new FormData(e.currentTarget).get("notes") ?? "")
                                );
                              }}
                            >
                              <input
                                name="notes"
                                defaultValue={r.notes ?? ""}
                                autoFocus
                                placeholder="What you're waiting for"
                                className="field px-1.5 py-0.5 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") setEditingNote(null);
                                }}
                                onBlur={(e) => saveNote(r.id, e.currentTarget.value)}
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingNote(r.id)}
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

                        {/* Remove */}
                        <td className="cell-pad-end text-right">
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

                      {/* Tier 3: Deep Dive Row for Desktop */}
                      {isOpen && (
                        <tr className="bg-ink-850/60">
                          <td colSpan={9} className="cell-wrap cell-pad-start px-5 py-5">
                            <div className="flex flex-col gap-6 max-w-5xl">
                              {/* Target and allocation inline editor */}
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700/60 pb-3">
                                <div className="flex items-center gap-2">
                                  <SlidersHorizontal size={14} className="text-accent" />
                                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                                    Targets & Position Plan
                                  </span>
                                </div>
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.currentTarget);
                                    const targetBuy = Number(fd.get("targetBuyPrice"));
                                    const alloc = Number(fd.get("targetAllocPct"));
                                    saveTarget(
                                      r.id,
                                      targetBuy > 0 ? targetBuy : null,
                                      alloc > 0 ? alloc : null
                                    );
                                  }}
                                  className="flex items-center gap-3 text-xs"
                                >
                                  <label className="text-ink-400">
                                    Target Buy ({symbol}):
                                    <input
                                      name="targetBuyPrice"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={r.targetBuyPrice ?? ""}
                                      className="field ml-1.5 h-7 w-24 px-2 py-0.5 font-mono text-xs"
                                      placeholder="None"
                                    />
                                  </label>
                                  <label className="text-ink-400">
                                    Target Alloc (fraction):
                                    <input
                                      name="targetAllocPct"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="1"
                                      defaultValue={r.targetAllocPct ?? ""}
                                      className="field ml-1.5 h-7 w-20 px-2 py-0.5 font-mono text-xs"
                                      placeholder="e.g. 0.05"
                                    />
                                  </label>
                                  <button type="submit" className="btn-primary-sm h-7 px-2.5 py-0">
                                    Save
                                  </button>
                                </form>
                              </div>

                              {/* Interactive Position Sizing Calculator */}
                              <PositionSizingCalculator
                                region={r.region}
                                ticker={r.ticker}
                                currentPrice={r.price}
                                targetBuyPrice={r.targetBuyPrice}
                                targetAllocPct={r.targetAllocPct}
                                portfolioTotalSgd={portfolioTotalSgd}
                                fxRates={fxRates}
                              />

                              {/* Technical Entry Signals (RSI, Trend, 1Y Range Chart) */}
                              {signal ? (
                                <WatchlistSignals
                                  signals={signal}
                                  series={entrySeries[key] ?? null}
                                  symbol={symbol}
                                />
                              ) : (
                                <p className="text-sm text-ink-300">Loading signals…</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Touch Cards (< md) with Tier 1/2/3 */}
            <div className="flex flex-col divide-y divide-ink-700/60 md:hidden">
              {rows.map((r) => {
                const symbol = currencySymbol[currencyForRegion(r.region)];
                const key = priceKey(r.region, r.ticker);
                const signal = signals?.[key] ?? null;
                const isOpen = expanded === r.id;
                const hasTarget = r.targetBuyPrice !== null && r.targetBuyPrice > 0;
                const atOrBelow = r.targetProximityPct !== null && r.targetProximityPct <= 0;
                const nearTarget =
                  r.targetProximityPct !== null &&
                  r.targetProximityPct > 0 &&
                  r.targetProximityPct <= 0.05;

                return (
                  <div key={r.id} className="flex flex-col gap-3 p-4">
                    {/* Tier 1 Header: Ticker, Region, Name, Price, Session Move */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="num text-base font-semibold text-ink-100">{r.ticker}</span>
                          <RegionFlag region={r.region} />
                          {hasTarget && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                atOrBelow
                                  ? "bg-accent/20 text-accent font-semibold"
                                  : nearTarget
                                    ? "bg-accent/10 text-accent"
                                    : "bg-ink-800 text-ink-400"
                              }`}
                            >
                              {atOrBelow
                                ? "At Target"
                                : `+${(r.targetProximityPct! * 100).toFixed(1)}%`}
                            </span>
                          )}
                        </div>
                        {r.name && <p className="truncate text-xs text-ink-300">{r.name}</p>}
                      </div>

                      <div className="text-right">
                        <p className="num text-base font-medium text-ink-100">
                          {r.price !== null ? (
                            <PlainMoney value={r.price} symbol={symbol} />
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </p>
                        <p className="num text-xs">
                          {r.dayChangePct !== null ? (
                            <Percent value={r.dayChangePct} />
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Tier 2 Context: Target Buy Price and Note */}
                    <div className="flex items-center justify-between border-t border-ink-800/80 pt-2 text-xs">
                      <div className="flex items-center gap-1.5 text-ink-400">
                        <span>Target:</span>
                        <span className="num font-medium text-ink-200">
                          {hasTarget ? `${symbol}${formatAmount(r.targetBuyPrice!)}` : "None"}
                        </span>
                        {r.targetAllocPct && (
                          <span className="text-ink-500">
                            ({(r.targetAllocPct * 100).toFixed(0)}% alloc)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingTarget(editingTarget === r.id ? null : r.id);
                        }}
                        className="text-[11px] text-ink-400 hover:text-accent"
                      >
                        {hasTarget ? "Edit target" : "+ Add target"}
                      </button>
                    </div>

                    {/* Inline Target Form on Mobile if triggered */}
                    {editingTarget === r.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const targetBuy = Number(fd.get("targetBuyPrice"));
                          const alloc = Number(fd.get("targetAllocPct"));
                          saveTarget(
                            r.id,
                            targetBuy > 0 ? targetBuy : null,
                            alloc > 0 ? alloc : null
                          );
                        }}
                        className="flex flex-col gap-2 rounded bg-ink-850 p-2.5 text-xs"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-ink-400">Target Buy ({symbol})</label>
                            <input
                              name="targetBuyPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={r.targetBuyPrice ?? ""}
                              className="field min-h-[38px] text-xs font-mono"
                              placeholder="Price"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-400">Alloc (e.g. 0.05)</label>
                            <input
                              name="targetAllocPct"
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              defaultValue={r.targetAllocPct ?? ""}
                              className="field min-h-[38px] text-xs font-mono"
                              placeholder="0.05"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary-sm min-h-[38px] flex-1">
                            Save target
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-sm min-h-[38px]"
                            onClick={() => setEditingTarget(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Why / Notes row on mobile */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      {editingNote === r.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            saveNote(r.id, String(new FormData(e.currentTarget).get("notes") ?? ""));
                          }}
                          className="flex-1"
                        >
                          <input
                            name="notes"
                            defaultValue={r.notes ?? ""}
                            autoFocus
                            placeholder="What you're waiting for"
                            className="field min-h-[38px] px-2 py-1 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingNote(null);
                            }}
                            onBlur={(e) => saveNote(r.id, e.currentTarget.value)}
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingNote(r.id)}
                          className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs"
                        >
                          <span className={`truncate ${r.notes ? "text-ink-100" : "text-ink-500 italic"}`}>
                            {r.notes ? `“${r.notes}”` : "Add thesis / note…"}
                          </span>
                          <Pencil size={10} className="shrink-0 text-ink-500" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(r.id)}
                        disabled={busy}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xs text-ink-500 hover:text-loss"
                        title="Remove from watchlist"
                        aria-label="Remove from watchlist"
                      >
                        <X size={16} strokeWidth={2} />
                      </button>
                    </div>

                    {/* Tier 3: Mobile Deep Dive Expand / Collapse (Calculator + Signals) */}
                    <div className="border-t border-ink-800/80 pt-1">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="flex min-h-[44px] w-full items-center justify-between text-xs font-medium text-ink-300 hover:text-accent"
                      >
                        <span>{isOpen ? "Hide calculator & signals" : "Deep Dive & Position Sizing"}</span>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isOpen && (
                        <div className="mt-3 flex flex-col gap-4 rounded-md bg-ink-850/60 p-3">
                          <PositionSizingCalculator
                            region={r.region}
                            ticker={r.ticker}
                            currentPrice={r.price}
                            targetBuyPrice={r.targetBuyPrice}
                            targetAllocPct={r.targetAllocPct}
                            portfolioTotalSgd={portfolioTotalSgd}
                            fxRates={fxRates}
                          />

                          {signal ? (
                            <WatchlistSignals
                              signals={signal}
                              series={entrySeries[key] ?? null}
                              symbol={symbol}
                            />
                          ) : (
                            <p className="text-xs text-ink-300">Loading signals…</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
