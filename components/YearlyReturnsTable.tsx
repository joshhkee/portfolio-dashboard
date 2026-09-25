import { formatAmount, Percent } from "@/components/SignedNumber";
import { currencySymbol } from "@/lib/fx";
import type { YearReturn } from "@/lib/performance";

const sgd = currencySymbol.SGD;

/**
 * Factsheet-style calendar-year table: one row per year, newest first.
 *
 * The return column is TIME-WEIGHTED (see lib/performance.ts) rather than a
 * value-over-value change, because the owner adds money every month — a naive
 * "end value vs start value" would show double-digit "returns" in a year where
 * nothing grew and half a million was deposited.
 */
export default function YearlyReturnsTable({ years }: { years: YearReturn[] }) {
  if (years.length === 0) return null;

  const rows = [...years].sort((a, b) => b.year - a.year);

  return (
    // A flex column that takes the height its slide has left, so the
    // `.table-scroll` inside is a flex child with `lg:flex-1` and scrolls its own
    // rows — the shell's rule for a table (docs/DESIGN.md §5). With three years
    // on record nothing scrolls today; the point is that adding a decade makes
    // the table taller inside its box rather than the slide taller than its
    // panel.
    <section className="flex min-h-0 flex-1 flex-col">
      {/* No heading and no closing sentence. The slide is named "Calendar
          years", and the one clause the note carried — that money added during
          the year is not growth — is on the column it explains, where it is
          read at the moment the figure is questioned. */}
      <div className="table-scroll">
        <table className="ledger-table table-compact">
          <thead>
            <tr>
              <th>Year</th>
              <th className="text-right">Start value</th>
              <th className="text-right">End value</th>
              <th className="text-right">Added</th>
              <th
                className="text-right"
                title="Time-weighted return: money added during the year does not count as growth."
              >
                Return (TWR)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((y) => (
              <tr key={y.year}>
                <td className="num">{y.year}</td>
                <td className="num text-right text-ink-300">
                  {sgd}
                  {formatAmount(y.startValue)}
                </td>
                <td className="num text-right">
                  {sgd}
                  {formatAmount(y.endValue)}
                </td>
                <td className="num text-right text-ink-300">
                  {y.contributions === 0 ? "—" : `${sgd}${formatAmount(y.contributions)}`}
                </td>
                <td className="text-right">
                  {y.returnPct === null ? (
                    <span className="text-ink-500" title="Not enough data in this year to compute a return">
                      —
                    </span>
                  ) : (
                    <Percent value={y.returnPct} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
