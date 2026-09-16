export interface PieSlice {
  label: string;
  value: number;
}

// A muted earth/slate ramp rather than the bright chart defaults — the
// accent gold is reserved for UI chrome (nav, CTAs, key totals), so the
// stakeholder breakdown reads as six quiet neutral hues instead.
const CHART_COLORS = ["#8c9a8e", "#7d8896", "#b0a48c", "#9b7f7a", "#6e7f7a", "#a89a9e"];

function formatAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PieChart({ slices }: { slices: PieSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  let cursor = 0;
  const stops = slices.map((s, i) => {
    const start = cursor;
    const pct = total === 0 ? 0 : (s.value / total) * 100;
    cursor += pct;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}% ${cursor}%`;
  });

  return (
    <div className="flex flex-wrap items-center gap-12">
      <div className="relative h-52 w-52 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={
            total === 0
              ? { background: "#212121" }
              : {
                  background: `conic-gradient(${stops.join(", ")})`,
                  // Punch the middle out rather than painting a solid
                  // circle over it, so the donut works on any surface.
                  maskImage: "radial-gradient(circle, transparent 57%, #000 58%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 57%, #000 58%)",
                }
          }
          role="img"
          aria-label="Contributions by stakeholder"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="label">Total</span>
          <span className="num text-sm text-fg">
            {total === 0 ? "—" : `$${formatAmount(total)}`}
          </span>
        </div>
      </div>

      <ul className="flex min-w-[15rem] flex-col">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-b-0"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-sm text-fg">{s.label}</span>
            <span className="num ml-auto text-sm text-fg-muted">${formatAmount(s.value)}</span>
            <span className="num w-16 text-right text-xs text-fg-subtle">
              {total === 0 ? "0.00" : ((s.value / total) * 100).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
