export interface AllocationSlice {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

function formatAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A name/value/% row per slice with a thin proportion bar underneath —
 * reads like an allocation list in a finance terminal, not a chart.
 * Chosen over a pie chart per the redesign brief: segments-with-legend
 * read as busy/cluttered against a minimalist serif+mono aesthetic. */
export default function AllocationBars({
  slices,
  symbol,
}: {
  slices: AllocationSlice[];
  symbol: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <ul className="flex flex-col gap-3">
      {slices.map((s) => {
        const pct = total === 0 ? 0 : (s.value / total) * 100;
        return (
          <li key={s.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-ink-100">
                {s.icon}
                {s.label}
              </span>
              <span className="num text-ink-300">
                {symbol}
                {formatAmount(s.value)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
