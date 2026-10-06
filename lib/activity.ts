export type ActivityFilter = "all" | "trades" | "deposits" | "exchanges";
export type ActivityDatePreset = "all" | "7days" | "30days" | "90days" | "custom";

export interface CustomActivityDateRange {
  from: string;
  to: string;
}

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
  /** A single attribution label, or several labels when multiple deposit batches arrived that day. */
  labels: string[];
  contributors: Array<{ name: string; amount: number }>;
  amount: number;
  /** How complete the recorded arrival dates are for deposits in this group. */
  arrivalDateStatus: "known" | "unknown" | "mixed";
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
 * Deposits are grouped by their effective calendar date. Each row retains its
 * stakeholder breakdown, and a missing paidOn date remains explicitly marked
 * rather than presented as a confirmed arrival.
 */
export function buildActivityTimeline({
  transactions,
  contributions,
  exchanges,
}: ActivityInputs): ActivityEvent[] {
  const depositGroups = new Map<
    string,
    {
      date: Date;
      amount: number;
      labels: Set<string>;
      contributors: Map<string, number>;
      knownArrivalCount: number;
      unknownArrivalCount: number;
    }
  >();

  for (const contribution of contributions) {
    const effectiveDate = contribution.paidOn ?? contribution.date;
    const dateKey = effectiveDate.toISOString().slice(0, 10);
    const group = depositGroups.get(dateKey) ?? {
      date: new Date(`${dateKey}T00:00:00.000Z`),
      amount: 0,
      labels: new Set<string>(),
      contributors: new Map<string, number>(),
      knownArrivalCount: 0,
      unknownArrivalCount: 0,
    };
    group.amount += contribution.amount;
    group.labels.add(contribution.label);
    group.contributors.set(
      contribution.contributor.name,
      (group.contributors.get(contribution.contributor.name) ?? 0) + contribution.amount
    );
    if (contribution.paidOn) group.knownArrivalCount += 1;
    else group.unknownArrivalCount += 1;
    depositGroups.set(dateKey, group);
  }

  const depositEvents: DepositActivity[] = Array.from(depositGroups, ([dateKey, group]) => ({
    id: `deposit:${dateKey}`,
    kind: "deposit",
    date: group.date,
    labels: Array.from(group.labels).sort((a, b) => a.localeCompare(b)),
    contributors: Array.from(group.contributors, ([name, amount]) => ({ name, amount })).sort(
      (a, b) => a.name.localeCompare(b.name)
    ),
    amount: group.amount,
    arrivalDateStatus:
      group.knownArrivalCount === 0
        ? "unknown"
        : group.unknownArrivalCount === 0
          ? "known"
          : "mixed",
  }));

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
    ...depositEvents,
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

    // IDs are table-local, so resolve event kinds first and only compare row
    // IDs inside the same ledger. Numeric comparison keeps row 2 ahead of row 10.
    const kindOrder = { trade: 0, deposit: 1, exchange: 2 } as const;
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
    if (a.kind === "deposit" && b.kind === "deposit") return a.date.getTime() - b.date.getTime();
    const aId = Number(a.id.slice(a.id.indexOf(":") + 1));
    const bId = Number(b.id.slice(b.id.indexOf(":") + 1));
    return aId - bId;
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

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || utcDateKey(date) !== value ? null : value;
}

/**
 * Filter calendar dates inclusively using UTC day keys, matching the timeline's
 * displayed dates. Preset windows include today and the preceding N-1 days.
 */
export function filterActivityByDateRange(
  events: ActivityEvent[],
  preset: ActivityDatePreset,
  custom: CustomActivityDateRange = { from: "", to: "" },
  now: Date = new Date()
): ActivityEvent[] {
  if (preset === "all") return events;

  let from: string | null = null;
  let to: string | null = null;
  if (preset === "custom") {
    from = custom.from ? parseDateInput(custom.from) : null;
    to = custom.to ? parseDateInput(custom.to) : null;
    if ((custom.from && from === null) || (custom.to && to === null)) return [];
  } else {
    const days = preset === "7days" ? 7 : preset === "30days" ? 30 : 90;
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    end.setUTCDate(end.getUTCDate() - (days - 1));
    from = utcDateKey(end);
    to = utcDateKey(now);
  }

  if (from && to && from > to) return [];
  return events.filter((event) => {
    const date = utcDateKey(event.date);
    return (!from || date >= from) && (!to || date <= to);
  });
}
