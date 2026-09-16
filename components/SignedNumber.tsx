function formatMoney(n: number) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "-" : ""}$${formatted}`;
}

function formatPct(n: number) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

export function Money({ value }: { value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span className={`num ${positive ? "text-positive" : negative ? "text-negative" : "text-fg"}`}>
      {formatMoney(value)}
    </span>
  );
}

export function Percent({ value }: { value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span className={`num ${positive ? "text-positive" : negative ? "text-negative" : "text-fg"}`}>
      {formatPct(value)}
    </span>
  );
}

export function PlainMoney({ value }: { value: number }) {
  return <span className="num">{formatMoney(Math.abs(value)).replace("-", "")}</span>;
}

/** For shares-of-total percentages (e.g. Portfolio %, % of portfolio) — these
 * aren't a gain/loss figure, so no green/red coloring and no leading "+". */
export function PlainPercent({ value }: { value: number }) {
  return <span className="num text-fg">{(value * 100).toFixed(2)}%</span>;
}

/** Like Money, but for figures in a native (non-USD) currency — takes the
 * currency's symbol (e.g. "S$", "HK$") instead of assuming "$".
 * showPlus adds a leading "+" on positive values, matching Percent. */
export function NativeMoney({
  value,
  symbol,
  showPlus = false,
}: {
  value: number;
  symbol: string;
  showPlus?: boolean;
}) {
  const positive = value > 0;
  const negative = value < 0;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <span className={`num ${positive ? "text-positive" : negative ? "text-negative" : "text-fg"}`}>
      {negative ? "-" : positive && showPlus ? "+" : ""}
      {symbol}
      {abs}
    </span>
  );
}

/** Caps qty display at 4 decimal places without padding whole numbers
 * with trailing zeros (10 -> "10", 10.5 -> "10.5", not "10.0000"). */
export function formatQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Comma-formatted amount with exactly 2 decimals, no symbol or sign —
 * for composing with a currency symbol that's already handled
 * separately, e.g. `{symbol}{formatAmount(price)}`. Same underlying
 * formatting Money/NativeMoney use, for always-positive figures like
 * a price or avg cost that don't need their sign/color logic. */
export function formatAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
