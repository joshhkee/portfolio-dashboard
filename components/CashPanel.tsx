"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { currencySymbol, type Currency, type FxRates, convertCurrency } from "@/lib/fx";
import { formatAmount } from "@/components/SignedNumber";
import { formatShortDate } from "@/lib/dates";
import RegionFlag from "@/components/RegionFlag";
import SegmentedControl from "@/components/SegmentedControl";

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
        <p className="flex items-center gap-1.5 text-sm text-ink-300">
          <RegionFlag region={CURRENCY_TO_REGION[currency]} />
          {currency}
        </p>
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
        {/* The app's one switch, not a hand-rolled copy of it: this pair of
            buttons was the fifth place the same control had been written out by
            hand, which is exactly how the pill stopped sliding on two of them
            (docs/DESIGN.md §7). */}
        <SegmentedControl
          ariaLabel="How the exchange rate is set"
          options={[
            { value: "manual", label: "Manual" },
            { value: "auto", label: "Auto rate" },
          ]}
          value={mode}
          onChange={setMode}
        />
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
    // `.screen`: three card rows are a fixed cost, and the exchange log — the
    // only block here that grows — takes the rest and scrolls inside its own
    // panel, so the balances never move off the screen.
    <div className="screen">
      <div className="page-bar">
        <h1
          className="text-sm font-medium text-ink-100"
          // The clause that used to be a sentence beside the cards, where it was
          // the first thing read and the least needed: a balance is
          // auto-adjusted, and you can correct one by hand. Both halves change
          // how a figure should be read, so both stay — on the label.
          title="Auto-adjusted by outlay, buys/sells and exchanges. Correct any balance by hand if it drifts from reality."
        >
          Cash balances
        </h1>
        {!exchanging && (
          <button
            onClick={() => setExchanging(true)}
            className="btn-ghost-sm flex items-center gap-1.5"
          >
            <ArrowRightLeft size={13} strokeWidth={2} />
            Exchange
          </button>
        )}
      </div>

      {exchanging && <ExchangeForm rates={rates} onClose={() => setExchanging(false)} />}

      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {CURRENCIES.map((c) => (
          <BalanceCard key={c} currency={c} balance={balances[c] ?? 0} />
        ))}
      </div>

      {recentExchanges.length > 0 && (
        <section className="panel panel-fit">
          <div className="panel-head">
            <p className="text-xs text-ink-300">Recent exchanges</p>
            <p className="text-xs text-ink-500">Last {recentExchanges.length}</p>
          </div>
          {/* A table, not a row of loose spans. The log was an unordered list
              with three items pushed apart by `justify-between`, so nothing
              lined up down the column: the amounts were one run-on string ("S$1,000 SGD
              → US$742.10 USD") and the two figures inside it never sat under
              each other, and "auto rate" was a right-aligned chip that looked
              like a second date. Same facts, four columns: when, what was sold,
              what was bought, and at what rate — every one of them a column
              that can be scanned and compared down the page.

              It is `.table-scroll` and NOT `.panel-body`, because a table IS
              the scroll region (its sticky header depends on being the nearest
              scroll container) and two nested scrollers would leave the header
              sticking to nothing — docs/DESIGN.md §4. Inside `.panel-fit` it
              takes `lg:flex-1`, so the balances above never move. */}
          <div className="table-scroll">
            <table className="ledger-table table-compact">
              <thead>
                <tr>
                  <th className="cell-pad-start">Date</th>
                  <th className="text-right">Sold</th>
                  <th className="text-right">Bought</th>
                  <th
                    className="text-right"
                    title="Units of the bought currency per one unit of the sold currency, as recorded on the exchange."
                  >
                    Rate
                  </th>
                  <th
                    className="cell-pad-end text-right"
                    title="Auto rate used the live quote when the exchange was recorded; manual is the amount you typed."
                  >
                    Priced by
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentExchanges.map((ex) => (
                  <tr key={ex.id}>
                    <td className="cell-pad-start text-ink-300">
                      {formatShortDate(new Date(ex.date))}
                    </td>
                    {/* Both money columns are neutral: an amount exchanged is a
                        value, and colour in this app means up or down (§2). */}
                    <td className="num text-right">
                      {currencySymbol[ex.fromCurrency as Currency]}
                      {formatAmount(ex.fromAmount)}
                      <span className="ml-1 text-xs text-ink-500">{ex.fromCurrency}</span>
                    </td>
                    <td className="num text-right">
                      {currencySymbol[ex.toCurrency as Currency]}
                      {formatAmount(ex.toAmount)}
                      <span className="ml-1 text-xs text-ink-500">{ex.toCurrency}</span>
                    </td>
                    <td className="num text-right text-ink-300">
                      <span
                        title={`1 ${ex.fromCurrency} = ${ex.rate.toFixed(4)} ${ex.toCurrency}`}
                      >
                        {ex.rate.toFixed(4)}
                      </span>
                    </td>
                    <td className="cell-pad-end text-right text-xs text-ink-500">
                      {ex.auto ? "auto" : "manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
