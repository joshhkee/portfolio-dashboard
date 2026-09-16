"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { currencySymbol, type Currency, type FxRates, convertCurrency } from "@/lib/fx";
import { formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";

const CURRENCIES: Currency[] = ["SGD", "USD", "HKD"];
const CURRENCY_TO_REGION: Record<Currency, string> = { SGD: "SG", USD: "US", HKD: "HK" };

interface ExchangeRecord {
  id: number;
  date: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  rate: number;
  auto: boolean;
}

function BalanceCard({ currency, balance }: { currency: Currency; balance: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const newBalance = form.get("balance");

    setBusy(true);
    try {
      const res = await fetch("/api/cash", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, balance: newBalance }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-300">{currency}</p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-ink-500 hover:text-accent"
            title={`Correct ${currency} balance by hand`}
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={handleSave} className="flex flex-col gap-2">
          <input
            name="balance"
            type="number"
            step="0.01"
            required
            autoFocus
            defaultValue={balance}
            className="field"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 py-1.5 text-xs" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn-ghost flex-1 py-1.5 text-xs"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-loss">{error}</p>}
        </form>
      ) : (
        <p className="num text-2xl font-medium text-ink-100">
          {currencySymbol[currency]}
          {formatAmount(balance)}
        </p>
      )}
    </div>
  );
}

function ExchangeForm({
  rates,
  onClose,
}: {
  rates: FxRates;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [fromCurrency, setFromCurrency] = useState<Currency>("SGD");
  const [toCurrency, setToCurrency] = useState<Currency>("USD");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoToAmount =
    mode === "auto" && fromAmount
      ? convertCurrency(Number(fromAmount), CURRENCY_TO_REGION[fromCurrency], toCurrency, rates)
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const finalToAmount = mode === "auto" ? autoToAmount : Number(toAmount);
    if (!finalToAmount || finalToAmount <= 0) {
      setError("Enter how much you received.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/cash/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          fromAmount: Number(fromAmount),
          toCurrency,
          toAmount: finalToAmount,
          auto: mode === "auto",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Exchange failed");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-100">Exchange currency</p>
        <div className="flex rounded-md border border-ink-700 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`rounded px-2.5 py-1 transition ${mode === "manual" ? "bg-accent text-ink-950" : "text-ink-300"}`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`rounded px-2.5 py-1 transition ${mode === "auto" ? "bg-accent text-ink-950" : "text-ink-300"}`}
          >
            Auto rate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-300">From</label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value as Currency)}
            className="field"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Amount sent"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="field"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-300">To</label>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value as Currency)}
            className="field"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {mode === "auto" ? (
            <div className="field flex items-center text-ink-300">
              {autoToAmount !== null ? (
                <span className="num">
                  {currencySymbol[toCurrency]}
                  {formatAmount(autoToAmount)}
                </span>
              ) : (
                <span className="text-ink-500">Enter an amount</span>
              )}
            </div>
          ) : (
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Amount received"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              className="field"
            />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy || fromCurrency === toCurrency}>
          {busy ? "Exchanging…" : "Exchange"}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
      {fromCurrency === toCurrency && (
        <p className="text-xs text-loss">Pick two different currencies.</p>
      )}
      {error && <p className="text-xs text-loss">{error}</p>}
    </form>
  );
}

export default function CashPanel({
  balances,
  rates,
  recentExchanges,
}: {
  balances: Record<string, number>;
  rates: FxRates;
  recentExchanges: ExchangeRecord[];
}) {
  const [exchanging, setExchanging] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-300">
          Cash balances — auto-adjusted by outlay, buys/sells, and exchanges; edit any balance
          directly if it drifts from reality.
        </p>
        {!exchanging && (
          <button onClick={() => setExchanging(true)} className="btn-ghost flex items-center gap-2">
            <ArrowRightLeft size={14} strokeWidth={2} />
            Exchange
          </button>
        )}
      </div>

      {exchanging && <ExchangeForm rates={rates} onClose={() => setExchanging(false)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CURRENCIES.map((c) => (
          <BalanceCard key={c} currency={c} balance={balances[c] ?? 0} />
        ))}
      </div>

      {recentExchanges.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-300">Recent exchanges</h2>
          <ul className="flex flex-col gap-2">
            {recentExchanges.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-300">{formatShortDate(new Date(ex.date))}</span>
                <span className="num text-ink-100">
                  {currencySymbol[ex.fromCurrency as Currency]}
                  {formatAmount(ex.fromAmount)} {ex.fromCurrency} → {currencySymbol[ex.toCurrency as Currency]}
                  {formatAmount(ex.toAmount)} {ex.toCurrency}
                </span>
                <span className="text-xs text-ink-500">{ex.auto ? "auto rate" : "manual rate"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
