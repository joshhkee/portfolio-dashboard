import type { Currency } from "@/lib/fx";

export interface DividendRecord {
  date: Date | string;
  region: string;
  ticker: string;
  amount: number;
  currency: Currency | string;
  amountSgd: number;
  withholding: number;
}

export interface DividendPosition {
  region: string;
  ticker: string;
  qty: number;
  avgCost: number;
}

export type DividendPositionRecord = Pick<DividendRecord, "date" | "region" | "ticker" | "amount">;

export interface DividendPositionMetric {
  incomeNative: number;
  yieldOnCost: number | null;
}

export interface DividendMonth {
  key: string;
  label: string;
  amountSgd: number;
}

function dateOf(record: { date: Date | string }): Date {
  return record.date instanceof Date ? record.date : new Date(record.date);
}

export function trailingDividendStart(asOf: Date = new Date()): Date {
  const year = asOf.getUTCFullYear() - 1;
  const month = asOf.getUTCMonth();
  const day = Math.min(asOf.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  // Payment dates are stored at UTC midnight. Normalizing the lookback to
  // midnight keeps the first matching calendar day inside the trailing year.
  return new Date(Date.UTC(year, month, day));
}

export function parseDividendDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

export function positionKey(region: string, ticker: string): string {
  return `${region}::${ticker.toUpperCase()}`;
}

function monthLabel(date: Date): string {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`;
}

/** Actual net receipts in the trailing 12 months, using UTC calendar dates. */
export function trailingDividendIncome(
  records: DividendRecord[],
  asOf: Date = new Date()
): { amountSgd: number; count: number; start: Date } {
  const start = trailingDividendStart(asOf);
  const matching = records.filter((record) => {
    const date = dateOf(record);
    return date >= start && date <= asOf;
  });
  return {
    amountSgd: matching.reduce((sum, record) => sum + record.amountSgd, 0),
    count: matching.length,
    start,
  };
}

/** Pair trailing native-currency income with each open holding's native cost. */
export function dividendPositionMetrics(
  records: DividendPositionRecord[],
  positions: DividendPosition[],
  asOf: Date = new Date()
): Record<string, DividendPositionMetric> {
  const start = trailingDividendStart(asOf);
  const incomes = new Map<string, number>();
  for (const record of records) {
    const date = dateOf(record);
    if (date < start || date > asOf) continue;
    const key = positionKey(record.region, record.ticker);
    incomes.set(key, (incomes.get(key) ?? 0) + record.amount);
  }

  return Object.fromEntries(
    positions.map((position) => {
      const key = positionKey(position.region, position.ticker);
      const incomeNative = incomes.get(key) ?? 0;
      const cost = position.qty * position.avgCost;
      return [
        key,
        { incomeNative, yieldOnCost: cost > 0 && incomes.has(key) ? incomeNative / cost : null },
      ];
    })
  );
}

/** Trailing-12-month receipt history by calendar month, including zero months. */
export function dividendMonthlyHistory(
  records: DividendRecord[],
  asOf: Date = new Date()
): DividendMonth[] {
  const months: DividendMonth[] = [];
  const start = trailingDividendStart(asOf);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: monthLabel(cursor),
      amountSgd: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const byMonth = new Map(months.map((month) => [month.key, month]));
  for (const record of records) {
    const date = dateOf(record);
    if (date < trailingDividendStart(asOf) || date > asOf) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = byMonth.get(key);
    if (month) month.amountSgd += record.amountSgd;
  }
  return months;
}
