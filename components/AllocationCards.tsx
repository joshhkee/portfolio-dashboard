export interface AllocationSlice {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

function formatAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Small cards — label/icon, value, % share, thin proportion bar — one
 * per slice, in a responsive grid. Label and value sit right next to
 * each other inside a narrow card instead of being stretched across a
 * full-width row, so several fit side by side without a long visual
 * gap between heading and figure. Matches the summary-card look used
 * for Holdings/Cash/Completed Trades/Outlay elsewhere.
 *
 * `compact` caps the grid at 2-3 columns instead of up to 5 — for
 * spots where this sits in a half-width column (e.g. side by side with
 * another section) rather than the full page width. */
export default function AllocationCards({
  slices,
  symbol,
  compact = false,
}: {
  slices: AllocationSlice[];
  symbol: string;
  compact?: boolean;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const gridCols = compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <div className={`grid gap-3 ${gridCols}`}>
      {slices.map((s) => {
        const pct = total === 0 ? 0 : (s.value / total) * 100;
        return (
          <div key={s.label} className="panel flex flex-col gap-2 p-4">
            <div className="flex items-center gap-1.5 text-sm text-ink-300">
              {s.icon}
              {s.label}
            </div>
            <div>
              <p className="num text-lg font-medium text-ink-100">
                {symbol}
                {formatAmount(s.value)}
              </p>
              <p className="text-xs text-ink-500">{pct.toFixed(1)}%</p>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
              {/* Gold by the owner's explicit choice — see the `data` palette
                  note in docs/PLAN.md before changing this. */}
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
