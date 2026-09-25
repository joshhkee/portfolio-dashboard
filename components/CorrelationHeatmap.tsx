"use client";

import { useEffect, useState } from "react";

interface MatrixPayload {
  keys: string[];
  matrix: (number | null)[][];
  observations: number;
}

/** Gold for "moves together", terracotta for "moves opposite" — the same two
 * tones the app already uses for value and loss, so the reading needs no new
 * legend vocabulary. Hex literals because these feed inline alpha compositing,
 * not a Tailwind class. */
const TOGETHER = "212, 169, 74"; // accent #d4a94a
const OPPOSITE = "192, 127, 116"; // loss #c07f74

function cellStyle(r: number | null): React.CSSProperties {
  if (r === null) return { backgroundColor: "#1d1d1d" };
  const alpha = Math.min(Math.abs(r), 1) * 0.8 + 0.04;
  const tone = r >= 0 ? TOGETHER : OPPOSITE;
  return { backgroundColor: `rgba(${tone}, ${alpha.toFixed(3)})` };
}

/** Dark text once a cell is bright enough that off-white would be low-contrast. */
function cellTextClass(r: number | null): string {
  if (r === null) return "text-ink-500";
  return Math.abs(r) > 0.55 ? "text-ink-950" : "text-ink-100";
}

/**
 * Pairwise correlation of daily returns across the held positions.
 *
 * Fetched on the client rather than rendered on the server: eighteen symbols
 * is a real amount of upstream work, and the panel is far enough down the page
 * that blocking the whole overview on it would be the wrong trade. The route
 * derives the ticker list from the ledger itself, so nothing here has to know
 * what is held.
 *
 * Tickers label the axes (names are too long for a 34px column) but each cell
 * carries the full names and the exact coefficient in its `title`, so the
 * matrix stays readable to a screen reader and on hover.
 */
export default function CorrelationHeatmap() {
  const [data, setData] = useState<MatrixPayload | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/correlation")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: { matrix: MatrixPayload; names: Record<string, string> }) => {
        if (cancelled) return;
        setData(payload.matrix);
        setNames(payload.names ?? {});
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-ink-300">
        Correlation data is unavailable right now. It refreshes from the price source, so it should
        come back on its own.
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-ink-500">Measuring how the holdings move together…</p>;
  }

  if (data.keys.length < 2) {
    return (
      <p className="text-sm text-ink-300">
        Correlation needs at least two open positions with price history.
      </p>
    );
  }

  const tickerOf = (key: string) => key.split("::")[1] ?? key;

  return (
    // The matrix is the one thing on this page whose size is set by the DATA
    // rather than by the design: eighteen open positions is an 18×18 grid, and
    // that is ~560px tall before the legend. So the grid is the block that gives
    // way — `flex-1` with its own `overflow-auto`, exactly like a table — and the
    // legend stays put under it. Without this the whole slide scrolled, which is
    // what the correlation matrix becoming its own sub-tab was meant to stop.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th className="w-16" />
              {data.keys.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="num w-10 pb-1 text-center text-[10px] font-normal text-ink-300"
                  title={names[key] ?? key}
                >
                  {tickerOf(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.keys.map((rowKey, i) => (
              <tr key={rowKey}>
                <th
                  scope="row"
                  className="num truncate pr-2 text-right text-[10px] font-normal text-ink-300"
                  title={names[rowKey] ?? rowKey}
                >
                  {tickerOf(rowKey)}
                </th>
                {data.keys.map((colKey, j) => {
                  const r = data.matrix[i]?.[j] ?? null;
                  const label =
                    i === j
                      ? `${names[rowKey] ?? rowKey}: itself`
                      : `${names[rowKey] ?? rowKey} vs ${names[colKey] ?? colKey}: ${
                          r === null ? "not enough overlapping days" : r.toFixed(2)
                        }`;
                  return (
                    <td
                      key={colKey}
                      title={label}
                      aria-label={label}
                      style={cellStyle(r)}
                      className={`num h-7 rounded text-center text-[10px] ${cellTextClass(r)}`}
                    >
                      {/* Two decimals, kept in full: rounding 0.95 to "1.0"
                          would claim a perfect relationship it doesn't have. */}
                      {i === j ? "·" : r === null ? "" : r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="shrink-0 text-xs text-ink-500">
        Gold = they move together, terracotta = opposite. {data.observations} days of daily
        returns, one pair at a time.
      </p>
    </div>
  );
}
