import { NativeMoney, formatAmount } from "@/components/SignedNumber";
import { currencySymbol } from "@/lib/fx";
import type { FxAttribution, FxAttributionRow } from "@/lib/exposure";

const sgd = currencySymbol.SGD;

function fxPair(row: FxAttributionRow): string {
  const pad = (n: number) => n.toFixed(4);
  return `${pad(row.fxAtCost)} → ${pad(row.fxNow)}`;
}

/**
 * A position's SGD P&L, split into what the SHARES did and what the CURRENCY
 * did.
 *
 * Why this exists: the holdings page converts a position's native-currency
 * P&L at today's FX rate. That silently treats the cost basis as if it had
 * been paid at today's rate, so a currency that moved since the purchase is
 * invisible in the headline number. Splitting it out says how much of the
 * return was the portfolio's own doing and how much was the exchange rate.
 *
 * Price P&L + FX P&L = Total P&L is exact by construction (see fxAttribution),
 * which is what the totals row lets the reader verify.
 */
export default function FxAttributionTable({
  attribution,
  names,
}: {
  attribution: FxAttribution;
  /** Compound "REGION::TICKER" -> cached instrument name. */
  names: Record<string, string>;
}) {
  if (attribution.rows.length === 0) {
    return (
      <p className="text-sm text-ink-300">
        No priced holdings to attribute — a position needs a live quote before its return can be
        split into price and currency.
      </p>
    );
  }

  // Largest exposure first: the biggest positions are where the FX answer
  // matters most, and it matches how every other table in the app sorts.
  const rows = [...attribution.rows].sort((a, b) => b.valueSgd - a.valueSgd);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="ledger-table table-compact">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Ccy</th>
              <th className="text-right">Value</th>
              <th className="text-right" title="What the shares still held actually cost, in SGD, at each purchase date's rate.">
                Cost (purchase FX)
              </th>
              <th className="text-right" title="P&L from the share price moving, measured at today's rate — this is the figure the holdings page shows.">
                Price P&amp;L
              </th>
              <th className="text-right" title="P&L from the exchange rate moving since the shares were bought.">
                FX P&amp;L
              </th>
              <th className="text-right" title="Price P&L + FX P&L — the SGD gain you would realise selling today.">
                Total P&amp;L
              </th>
              <th className="text-right" title="SGD per unit of the currency at the (weighted) purchase dates, and today.">
                FX then → now
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  {/* Ticker above, name beneath — the same two-line shape the
                      positions tables use. One line would need `truncate`,
                      which does nothing on an inline span, so a long fund name
                      silently bled into the Value column instead of ellipsing. */}
                  <span className="num block text-ink-100">{row.ticker}</span>
                  <span
                    className="block max-w-[200px] truncate text-xs text-ink-300"
                    title={names[row.key] ?? undefined}
                  >
                    {names[row.key] ?? ""}
                  </span>
                </td>
                <td className="num text-ink-300">{row.currency}</td>
                <td className="num text-right text-ink-100">S${formatAmount(row.valueSgd)}</td>
                <td className="num text-right text-ink-300">S${formatAmount(row.costSgd)}</td>
                <td className="num text-right">
                  <NativeMoney value={row.localPlSgd} symbol={sgd} showPlus />
                </td>
                <td className="num text-right">
                  {/* Zero to the cent is printed as "0.00" with no sign and a
                      muted tone: an SGD position genuinely has no currency
                      exposure, and colouring a sub-cent residue green or red
                      would imply a move that never happened. */}
                  {Math.abs(row.fxPlSgd) < 0.005 ? (
                    <span
                      className="text-ink-500"
                      title={
                        row.currency === "SGD"
                          ? "No currency exposure — this position trades in SGD."
                          : "The exchange rate has not moved enough to move this position's SGD value by a cent."
                      }
                    >
                      0.00
                    </span>
                  ) : (
                    <NativeMoney value={row.fxPlSgd} symbol={sgd} showPlus />
                  )}
                </td>
                <td className="num text-right">
                  <NativeMoney value={row.totalPlSgd} symbol={sgd} showPlus />
                </td>
                <td className="num text-right text-xs text-ink-500">{fxPair(row)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-600">
              <td className="text-ink-300">Total</td>
              <td />
              <td className="num text-right text-ink-100">S${formatAmount(attribution.valueSgd)}</td>
              <td className="num text-right text-ink-300">S${formatAmount(attribution.costSgd)}</td>
              <td className="num text-right">
                <NativeMoney value={attribution.localPlSgd} symbol={sgd} showPlus />
              </td>
              <td className="num text-right">
                <NativeMoney value={attribution.fxPlSgd} symbol={sgd} showPlus />
              </td>
              <td className="num text-right">
                <NativeMoney value={attribution.totalPlSgd} symbol={sgd} showPlus />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-ink-300">
        The holdings page converts each position&apos;s P&amp;L at today&apos;s rate, which is the
        Price P&amp;L column exactly. Cost was really paid at the rate of each purchase date, so
        Price + FX is the SGD gain you would bank selling today — a difference of{" "}
        <span className="num">
          <NativeMoney value={attribution.differenceSgd} symbol={sgd} showPlus />
        </span>{" "}
        across {rows.length} position{rows.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
