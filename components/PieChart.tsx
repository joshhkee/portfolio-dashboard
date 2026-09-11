export interface PieSlice {
  label: string;
  value: number;
}

// Distinct hues chosen to read clearly against the dark ink background —
// not reusing gain/loss since this chart isn't a P/L figure.
const CHART_COLORS = ["#e8a33d", "#4f8fe8", "#3ecf8e", "#b98ae8", "#f2545b", "#5fd0e8"];

function formatAmount(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="flex flex-wrap items-center gap-10">
      <div
        className="h-48 w-48 shrink-0 rounded-full"
        style={{
          background: total === 0 ? "#1a2333" : `conic-gradient(${stops.join(", ")})`,
        }}
        role="img"
        aria-label="Contributions by stakeholder"
      />
      <ul className="flex flex-col gap-2.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="w-20 text-ink-100">{s.label}</span>
            <span className="num w-24 text-ink-300">${formatAmount(s.value)}</span>
            <span className="num text-ink-300">
              {total === 0 ? "0.00" : ((s.value / total) * 100).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
