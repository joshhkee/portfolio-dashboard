"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import SegmentedControl from "@/components/SegmentedControl";
import { formatAmount } from "@/lib/format";
import { formatShortDate, toLocalDateInputValue } from "@/lib/dates";
import { currencyForRegion, currencySymbol, type Currency } from "@/lib/fx";
import { dividendMonthlyHistory, type DividendRecord } from "@/lib/dividends";

interface DividendRow extends DividendRecord {
  id: number;
  notes: string | null;
}

const REGIONS = ["US", "SG", "HK"] as const;
type View = "payments" | "history";

function Money({ amount, currency }: { amount: number; currency: Currency | string }) {
  const symbol = currencySymbol[currency as Currency] ?? `${currency} `;
  return <span className="num">{symbol}{formatAmount(amount)}</span>;
}

export default function DividendPanel({ records }: { records: DividendRow[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("payments");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("US");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") === "1") {
      setAdding(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/dividends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.get("date"),
          region: form.get("region"),
          ticker: form.get("ticker"),
          amount: form.get("amount"),
          withholding: form.get("withholding"),
          notes: form.get("notes"),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not record payment");
      }
      setAdding(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: DividendRow) {
    if (!window.confirm(`Remove the ${(currencySymbol[record.currency as Currency] ?? `${record.currency} `)}${formatAmount(record.amount)} payment from ${record.ticker}? Its cash credit will be reversed.`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/dividends/${record.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not remove payment");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    }
  }

  const today = toLocalDateInputValue(new Date());
  const history = dividendMonthlyHistory(records);
  const peak = Math.max(1, ...history.map((month) => month.amountSgd));
  const last12Sgd = history.reduce((sum, month) => sum + month.amountSgd, 0);

  return (
    <div className="screen">
      <div className="page-bar">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-medium text-ink-100">Dividends</h1>
          <p className="num text-xs text-ink-500" aria-live="polite">{records.length} payments</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedControl
            ariaLabel="Dividend view"
            options={[{ value: "payments", label: "Payments" }, { value: "history", label: "TTM history" }]}
            value={view}
            onChange={setView}
          />
          {view === "payments" && (
            <button
              type="button"
              onClick={() => window.location.assign("/api/export/dividends")}
              className="btn-ghost-sm flex items-center gap-1.5"
            >
              <Download size={13} strokeWidth={1.75} /> Export
            </button>
          )}
          <button type="button" onClick={() => { setAdding((open) => !open); setError(null); }} className="btn-primary-sm flex items-center gap-1.5">
            <Plus size={13} strokeWidth={1.75} /> Record payment
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={submit} className="panel flex shrink-0 flex-col gap-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300">
              Payment date
              <input name="date" type="date" required defaultValue={today} className="field min-h-[44px] text-xs" />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300">
              Market
              <select name="region" required value={region} onChange={(event) => setRegion(event.target.value as (typeof REGIONS)[number])} className="field min-h-[44px] text-xs">
                {REGIONS.map((region) => <option key={region} value={region}>{region} · {currencyForRegion(region)}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300">
              Ticker
              <input name="ticker" required maxLength={32} autoCapitalize="characters" placeholder="e.g. VOO" className="field min-h-[44px] text-xs" />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300" title="The net amount actually credited after any withholding.">
              Net received ({currencyForRegion(region)})
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" className="field min-h-[44px] text-xs" />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300" title="Recorded separately for reference; not credited to cash.">
              Withholding ({currencyForRegion(region)})
              <input name="withholding" type="number" min="0" step="0.01" defaultValue="0" className="field min-h-[44px] text-xs" />
            </label>
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-300">
            Note <input name="notes" maxLength={1000} className="field min-h-[44px] text-xs" />
          </label>
          <p className="text-xs text-ink-500">Cash balance increases by the net amount. SGD value uses the payment-date FX close; no future payment dates are inferred.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary min-h-[44px]">{busy ? "Saving…" : "Save payment"}</button>
            <button type="button" disabled={busy} onClick={() => setAdding(false)} className="btn-ghost min-h-[44px]">Cancel</button>
          </div>
          {error && <p role="alert" className="text-xs text-loss">{error}</p>}
        </form>
      )}

      {error && !adding && <p role="alert" className="text-xs text-loss">{error}</p>}

      {view === "history" ? (
        <section className="panel panel-fit flex min-h-0 flex-col">
          <div className="panel-head">
            <p className="text-xs text-ink-300">TTM net dividend receipts</p>
            <p className="num text-xs text-ink-100" title="Recorded net payments converted to SGD">S${formatAmount(last12Sgd)} · last 12 months</p>
          </div>
          <div className="panel-body flex flex-col gap-1.5">
            {history.map((month) => (
              <div key={month.key} className="grid grid-cols-[3.5rem_minmax(0,1fr)_7rem] items-center gap-3 text-xs">
                <span className="text-ink-300">{month.label}</span>
                <div className="h-2 overflow-hidden rounded bg-ink-800" aria-hidden="true">
                  <div className="h-full rounded bg-accent/70" style={{ width: `${month.amountSgd === 0 ? 0 : Math.max(2, month.amountSgd / peak * 100)}%` }} />
                </div>
                <span className="num text-right text-ink-100">S${formatAmount(month.amountSgd)}</span>
              </div>
            ))}
            {records.length === 0 && <p className="py-4 text-center text-sm text-ink-500">Recorded payment history will appear here.</p>}
          </div>
          <p className="shrink-0 px-3 pb-3 text-xs text-ink-500">Recorded receipts only. This is not a forecast or inferred payment schedule.</p>
        </section>
      ) : records.length === 0 ? (
        <div className="panel flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-300">No dividend payments recorded yet.</div>
      ) : (
        <section className="panel panel-fit">
          <div className="table-scroll hidden sm:block">
            <table className="ledger-table table-compact">
              <thead><tr><th className="cell-pad-start">Date</th><th>Holding</th><th className="text-right">Net received</th><th className="text-right">Withheld</th><th className="cell-pad-end">Note</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{records.map((record) => (
                <tr key={record.id}>
                  <td className="cell-pad-start text-ink-300">{formatShortDate(new Date(record.date))}</td>
                  <td><span className="num text-ink-100">{record.ticker}</span><span className="ml-2 text-xs text-ink-500">{record.region}</span></td>
                  <td className="num text-right text-ink-100"><Money amount={record.amount} currency={record.currency} /></td>
                  <td className="num text-right text-ink-300"><Money amount={record.withholding} currency={record.currency} /></td>
                  <td className="max-w-[16rem] truncate text-xs text-ink-300" title={record.notes ?? undefined}>{record.notes || "—"}</td>
                  <td className="text-right"><button type="button" onClick={() => void remove(record)} aria-label={`Remove ${record.ticker} dividend from ${formatShortDate(new Date(record.date))}`} className="min-h-[36px] min-w-[36px] text-ink-500 hover:text-loss"><Trash2 size={14} className="mx-auto" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <ul className="divide-y divide-ink-700 sm:hidden" aria-label="Dividend payments">
            {records.map((record) => (
              <li key={record.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2"><span className="num font-medium text-ink-100">{record.ticker}</span><span className="text-xs text-ink-500">{record.region} · {formatShortDate(new Date(record.date))}</span></p>
                  {record.withholding > 0 && <p className="mt-1 text-xs text-ink-500">Withheld <Money amount={record.withholding} currency={record.currency} /></p>}
                  {record.notes && <p className="mt-1 truncate text-xs text-ink-300">{record.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right"><p className="text-xs text-ink-500">Net received</p><Money amount={record.amount} currency={record.currency} /></div>
                  <button type="button" onClick={() => void remove(record)} aria-label={`Remove ${record.ticker} dividend from ${formatShortDate(new Date(record.date))}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-500 hover:text-loss"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
