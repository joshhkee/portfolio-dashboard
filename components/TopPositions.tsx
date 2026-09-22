"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NativeMoney, Percent } from "@/components/SignedNumber";
import Sparkline from "@/components/Sparkline";
import { priceKey } from "@/lib/prices";

export interface TopPositionRow {
  region: string;
  ticker: string;
  name: string | null;
  valueSgd: number;
  /** Unrealized P/L as a fraction, e.g. 0.102 for +10.2% — `Percent` scales it. */
  plPct: number;
  /** No live quote — the value shown is cost basis, so the row says so. */
  priceUnavailable: boolean;
}

/**
 * The largest positions, as a strip rather than a table.
 *
 * The dashboard's job is "what do I own and is anything off", so this shows the
 * concentration that matters and lets the full table live on its own page. Each
 * row is a link into that region's table with the ticker preselected, so the
 * strip is a door and not a dead summary.
 *
 * Sparklines arrive from the same batched endpoint the holdings table uses —
 * ONE request for every row (see app/api/sparklines/route.ts), fetched after
 * paint so a slow quote source can never hold up the dashboard. A ticker with
 * no usable history renders a dash rather than an invented flat line.
 */
export default function TopPositions({
  rows,
  totalCount,
  hiddenCount,
}: {
  rows: TopPositionRow[];
  totalCount: number;
  hiddenCount: number;
}) {
  const [spark, setSpark] = useState<Record<string, number[]>>({});

  const keys = useMemo(() => rows.map((r) => priceKey(r.region, r.ticker)).join(","), [rows]);

  useEffect(() => {
    if (!keys) return;
    let cancelled = false;
    fetch(`/api/sparklines?keys=${encodeURIComponent(keys)}`)
      .then((res) => (res.ok ? res.json() : { series: {} }))
      .then((data) => {
        if (!cancelled) setSpark(data.series ?? {});
      })
      .catch(() => {
        if (!cancelled) setSpark({});
      });
    return () => {
      cancelled = true;
    };
  }, [keys]);

  return (
    <section className="panel flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
          Largest positions
        </p>
        <Link
          href="/positions/us"
          className="text-xs text-ink-500 transition hover:text-accent motion-reduce:transition-none"
        >
          All {totalCount}
          {hiddenCount > 0 ? ` (+${hiddenCount} more)` : ""} →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-300">Nothing held yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-700/60">
          {rows.map((row) => {
            const key = priceKey(row.region, row.ticker);
            const series = spark[key];
            return (
              <li key={key}>
                <Link
                  href={`/positions/${row.region.toLowerCase()}?ticker=${encodeURIComponent(
                    row.ticker
                  )}`}
                  className="flex items-center gap-3 py-2.5 transition hover:text-accent motion-reduce:transition-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="num text-ink-100">{row.ticker}</span>
                      <span className="text-xs text-ink-500">{row.region}</span>
                      {row.priceUnavailable && (
                        <span
                          className="text-[10px] text-ink-500"
                          title="No live quote — valued at cost basis."
                        >
                          at cost
                        </span>
                      )}
                    </span>
                    {row.name && (
                      <span className="block max-w-[220px] truncate text-xs text-ink-300">
                        {row.name}
                      </span>
                    )}
                  </span>

                  <span className="hidden shrink-0 sm:block">
                    {series && series.length > 1 ? (
                      <Sparkline values={series} />
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )}
                  </span>

                  <span className="num w-24 shrink-0 text-right text-sm text-ink-100">
                    <NativeMoney value={row.valueSgd} symbol="S$" />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm">
                    <Percent value={row.plPct} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
