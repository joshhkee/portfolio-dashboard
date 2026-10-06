"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, ArrowUpRight, Banknote, Repeat2 } from "lucide-react";
import SegmentedControl from "@/components/SegmentedControl";
import { PlainMoney } from "@/components/SignedNumber";
import { formatAmount, formatQty } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { currencySymbol } from "@/lib/fx";
import {
  filterActivityByDateRange,
  filterActivityTimeline,
  type ActivityDatePreset,
  type ActivityEvent,
  type ActivityFilter,
} from "@/lib/activity";

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "deposits", label: "Deposits" },
  { value: "exchanges", label: "Exchanges" },
];

const DATE_PRESETS: { value: ActivityDatePreset; label: string }[] = [
  { value: "all", label: "Any date" },
  { value: "7days", label: "7 days" },
  { value: "30days", label: "30 days" },
  { value: "90days", label: "90 days" },
  { value: "custom", label: "Custom" },
];

function EventDescription({ event }: { event: ActivityEvent }) {
  if (event.kind === "trade") {
    const isBuy = event.action.toLowerCase() === "buy";
    return (
      <>
        <div className="flex min-w-0 items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${isBuy ? "border-gain/30 bg-gainBg text-gain" : "border-loss/30 bg-lossBg text-loss"}`}>
            {event.action}
          </span>
          <span className="truncate font-medium text-ink-100">{event.ticker}</span>
          <span className="shrink-0 text-xs text-ink-500">{event.region}</span>
        </div>
        <p className="mt-1 text-xs text-ink-300">{formatQty(event.qty)} shares · {currencySymbolForRegion(event.region)}{formatAmount(event.price)} each</p>
      </>
    );
  }

  if (event.kind === "deposit") {
    return (
      <>
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-300">Deposit</span>
          <span className="truncate font-medium text-ink-100">{event.labels.join(" · ")}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-300">
          {event.contributors.map((contributor) => (
            <span key={contributor.name} className="whitespace-nowrap">
              {contributor.name} <span className="num text-ink-500">S${formatAmount(contributor.amount)}</span>
            </span>
          ))}
        </div>
        {event.arrivalDateStatus !== "known" && (
          <p className="mt-1 text-xs text-ink-500">
            {event.arrivalDateStatus === "unknown" ? "Arrival date not recorded" : "Some arrival dates not recorded"}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-300">Exchange</span>
        <span className="truncate font-medium text-ink-100">{event.fromCurrency} → {event.toCurrency}</span>
      </div>
      <p className="mt-1 text-xs text-ink-300">
        {event.auto ? "Auto" : "Manual"} rate · 1 {event.fromCurrency} = {event.rate.toFixed(4)} {event.toCurrency}
      </p>
    </>
  );
}

function currencySymbolForRegion(region: string) {
  if (region === "SG") return "S$";
  if (region === "HK") return "HK$";
  return "US$";
}

function EventAmount({ event }: { event: ActivityEvent }) {
  if (event.kind === "trade") {
    const symbol = currencySymbolForRegion(event.region);
    return (
      <div className="text-right">
        <p className="num text-sm text-ink-100">{symbol}{formatAmount(event.qty * event.price)}</p>
        <p className="num text-xs text-ink-500">{formatQty(event.qty)} × {symbol}{formatAmount(event.price)}</p>
      </div>
    );
  }
  if (event.kind === "deposit") {
    return <PlainMoney value={event.amount} symbol="S$" />;
  }
  return (
    <div className="text-right">
      <p className="num text-sm text-ink-100">{currencySymbol[event.toCurrency as keyof typeof currencySymbol] ?? `${event.toCurrency} `}{formatAmount(event.toAmount)}</p>
      <p className="num text-xs text-ink-500">−{currencySymbol[event.fromCurrency as keyof typeof currencySymbol] ?? `${event.fromCurrency} `}{formatAmount(event.fromAmount)}</p>
    </div>
  );
}

function EventIcon({ event }: { event: ActivityEvent }) {
  const Icon = event.kind === "trade" ? Repeat2 : event.kind === "deposit" ? Banknote : ArrowUpRight;
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;
}

export default function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [datePreset, setDatePreset] = useState<ActivityDatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const visible = useMemo(() => {
    const byKind = filterActivityTimeline(events, filter);
    return filterActivityByDateRange(byKind, datePreset, { from: dateFrom, to: dateTo });
  }, [events, filter, datePreset, dateFrom, dateTo]);

  return (
    <div className="screen">
      <div className="page-bar">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-medium text-ink-100">Activity</h1>
          <p className="num text-xs text-ink-500" aria-live="polite">
            {visible.length}{filter === "all" ? " entries" : ` ${filter}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Filter activity"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
          />
          <SegmentedControl
            ariaLabel="Activity date range"
            options={DATE_PRESETS}
            value={datePreset}
            onChange={setDatePreset}
          />
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
              <label className="flex min-h-[44px] items-center gap-2">
                From
                <input
                  aria-label="Activity from date"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="field min-h-[44px] text-xs"
                />
              </label>
              <label className="flex min-h-[44px] items-center gap-2">
                To
                <input
                  aria-label="Activity to date"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="field min-h-[44px] text-xs"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-300">
          No {filter === "all" ? "activity" : filter} recorded yet.
        </div>
      ) : (
        <ol aria-label="Chronological activity" className="min-h-0 flex-1 divide-y divide-ink-700 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900">
          {visible.map((event) => (
            <li key={event.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-3 sm:grid-cols-[2rem_6rem_minmax(0,1fr)_auto] sm:px-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 text-ink-300" aria-hidden="true">
                {event.kind === "exchange" ? <ArrowRightLeft size={16} strokeWidth={1.75} /> : <EventIcon event={event} />}
              </span>
              <time dateTime={event.date.toISOString()} className="col-start-2 row-start-1 text-xs text-ink-500 sm:col-start-2 sm:row-auto">{formatShortDate(event.date)}</time>
              <div className="col-span-2 col-start-2 min-w-0 sm:col-span-1 sm:col-start-3">
                <EventDescription event={event} />
              </div>
              <div className="col-start-3 row-start-1 self-start pt-0.5 sm:col-start-4 sm:row-auto sm:self-center sm:pt-0">
                <EventAmount event={event} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
        <span>Deposits use the recorded arrival date when available; otherwise the attribution date is shown.</span>
        <div className="flex gap-3">
          <Link href="/positions/transactions" className="inline-flex min-h-[44px] items-center gap-1 text-ink-300 hover:text-ink-100 sm:min-h-0">Transactions ledger <ArrowUpRight size={12} aria-hidden="true" /></Link>
          <Link href="/money" className="inline-flex min-h-[44px] items-center gap-1 text-ink-300 hover:text-ink-100 sm:min-h-0">Deposits <ArrowUpRight size={12} aria-hidden="true" /></Link>
          <Link href="/money/cash" className="inline-flex min-h-[44px] items-center gap-1 text-ink-300 hover:text-ink-100 sm:min-h-0">Cash &amp; FX <ArrowUpRight size={12} aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
