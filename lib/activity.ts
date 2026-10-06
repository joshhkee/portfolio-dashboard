export type ActivityFilter = "all" | "trades" | "deposits" | "exchanges";

interface ActivityBase {
  id: string;
  date: Date;
}

export interface TradeActivity extends ActivityBase {
  kind: "trade";
  action: string;
  ticker: string;
  region: string;
  qty: number;
  price: number;
}

export interface DepositActivity extends ActivityBase {
  kind: "deposit";
  label: string;
  contributor: string;
  amount: number;
  /** True when `date` is the attribution date rather than a recorded arrival. */
  arrivalDateUnknown: boolean;
  attributedDate: Date;
}

export interface ExchangeActivity extends ActivityBase {
  kind: "exchange";
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  rate: number;
  auto: boolean;
}

export type ActivityEvent = TradeActivity | DepositActivity | ExchangeActivity;

export interface ActivityInputs {
  transactions: Array<{
    id: number;
    date: Date;
    action: string;
    ticker: string;
    region: string;
    qty: number;
    price: number;
  }>;
  contributions: Array<{
    id: number;
    date: Date;
    paidOn: Date | null;
    label: string;
    amount: number;
    contributor: { name: string };
  }>;
  exchanges: Array<{
    id: number;
    date: Date;
    fromCurrency: string;
    fromAmount: number;
    toCurrency: string;
    toAmount: number;
    rate: number;
    auto: boolean;
  }>;
}

/**
 * A read-only projection of the existing ledgers for quick chronological review.
 * Deposits use their recorded arrival date when available; otherwise their
 * attribution date is only a sorting anchor and the event remains explicitly
 * marked as having no recorded arrival date.
 */
export function buildActivityTimeline({
  transactions,
  contributions,
  exchanges,
}: ActivityInputs): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...transactions.map((transaction): TradeActivity => ({
      id: `trade:${transaction.id}`,
      kind: "trade",
      date: transaction.date,
      action: transaction.action,
      ticker: transaction.ticker,
      region: transaction.region,
      qty: transaction.qty,
      price: transaction.price,
    })),
    ...contributions.map((contribution): DepositActivity => ({
      id: `deposit:${contribution.id}`,
      kind: "deposit",
      date: contribution.paidOn ?? contribution.date,
      attributedDate: contribution.date,
      arrivalDateUnknown: contribution.paidOn === null,
      label: contribution.label,
      contributor: contribution.contributor.name,
      amount: contribution.amount,
    })),
    ...exchanges.map((exchange): ExchangeActivity => ({
      id: `exchange:${exchange.id}`,
      kind: "exchange",
      date: exchange.date,
      fromCurrency: exchange.fromCurrency,
      fromAmount: exchange.fromAmount,
      toCurrency: exchange.toCurrency,
      toAmount: exchange.toAmount,
      rate: exchange.rate,
      auto: exchange.auto,
    })),
  ];

  return events.sort((a, b) => {
    const byDate = b.date.getTime() - a.date.getTime();
    if (byDate !== 0) return byDate;

    // IDs are table-local, so compare their numeric values first and use the
    // event kind to break cross-ledger ties deterministically. String ordering
    // would put row 10 before row 2 on a shared date.
    const byId = Number(a.id.slice(a.id.indexOf(":") + 1)) - Number(b.id.slice(b.id.indexOf(":") + 1));
    return byId || a.kind.localeCompare(b.kind);
  });
}

/** Select one of the roadmap's four views without mutating the timeline. */
export function filterActivityTimeline(
  events: ActivityEvent[],
  filter: ActivityFilter
): ActivityEvent[] {
  if (filter === "all") return events;
  const kindByFilter = { trades: "trade", deposits: "deposit", exchanges: "exchange" } as const;
  return events.filter((event) => event.kind === kindByFilter[filter]);
}
