"use client";

import { formatAmount } from "@/lib/format";
import { rsiZone, type EntrySeries, type EntrySignals } from "@/lib/entry-signals";
import RangeBar, { rangePositionLabel } from "@/components/RangeBar";
import EntryLevelChart from "@/components/EntryLevelChart";
import SignalsExplainer from "@/components/SignalsExplainer";

/** One signal, with its unit, in a fixed-width tile. */
function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-ink-300">{label}</p>
      {children}
    </div>
  );
}

function NotEnough({ sessions }: { sessions: number }) {
  return (
    <p className="text-sm text-ink-300">
      Not enough history to read yet — {sessions} trading session{sessions === 1 ? "" : "s"},
      and these signals need 200. A newly listed ticker answers this honestly rather
      than showing a 52-week range built from a fortnight.
    </p>
  );
}

const TREND_LABEL: Record<string, string> = {
  up: "Uptrend",
  down: "Downtrend",
  mixed: "Mixed",
};

const ZONE_LABEL: Record<string, string> = {
  oversold: "Oversold",
  neutral: "Neutral",
  overbought: "Overbought",
};

/**
 * The four entry-timing signals for one watchlist row, expanded under it, plus
 * the year of prices they were computed from.
 *
 * Extra columns were the obvious alternative and the wrong one: this table has
 * six columns already and the owner has twice asked for no horizontal
 * scrolling, so the row stays the snapshot and the deliberation lives one click
 * below it.
 *
 * Nothing here is coloured but the numbers that mean up or down, and every
 * figure carries its unit — the read is the owner's to make, which is what
 * SignalsExplainer is for: it says what each measure is normally taken to mean
 * without turning any of them into an instruction.
 */
export default function WatchlistSignals({
  signals,
  series,
  symbol,
}: {
  signals: EntrySignals;
  /** The closes the signals were computed from. Absent only if the fetch is
   *  older than this component, in which case the tiles still stand alone. */
  series?: EntrySeries | null;
  symbol: string;
}) {
  if (signals.sessions < 200 || signals.rangeHigh === null || signals.rangeLow === null) {
    return <NotEnough sessions={signals.sessions} />;
  }

  const zone = rsiZone(signals.rsi14);
  const belowPct = signals.pctBelowHigh === null ? null : signals.pctBelowHigh * 100;
  // Same rule as the row: the label is derived once, in RangeBar, so the bar's
  // accessible name and the detail here can never disagree about the position.
  const positionLabel = signals.rangePosition === null ? null : rangePositionLabel(signals.rangePosition);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
        <Tile label="Position in 1-year range">
          {signals.rangePosition === null ? (
            <p className="num text-sm text-ink-500">Flat — no range to place it in</p>
          ) : (
            <>
              <p className="num text-base">{positionLabel}</p>
              <RangeBar position={signals.rangePosition} width={144} label={positionLabel!} />
              <p className="num text-xs text-ink-300">
                {symbol}
                {formatAmount(signals.rangeLow)} low · {symbol}
                {formatAmount(signals.rangeHigh)} high
              </p>
            </>
          )}
        </Tile>

        <Tile label="Below 1-year high">
          <p className="num text-base">
            {belowPct === null ? "—" : `${belowPct < 0.05 ? "0.0" : belowPct.toFixed(1)}%`}
          </p>
          <p className="text-xs text-ink-300">
            {belowPct === null
              ? "No high to compare against"
              : belowPct < 0.05
                ? "At its high"
                : `High was ${symbol}${formatAmount(signals.rangeHigh)}`}
          </p>
        </Tile>

        <Tile label="RSI (14)">
          <p className="num text-base">
            {signals.rsi14 === null ? "—" : signals.rsi14.toFixed(1)}
            {zone && <span className="ml-2 text-xs text-ink-300">{ZONE_LABEL[zone]}</span>}
          </p>
          <p className="text-xs text-ink-300">
            {/* Says what the band means rather than leaving the number to be
                decoded: the whole point of showing it is the read. */}
            {zone === "oversold"
              ? "Below 30 — sold off hard"
              : zone === "overbought"
                ? "Above 70 — run up hard"
                : "Between the 30 / 70 bands"}
          </p>
        </Tile>

        <Tile label="Trend">
          <p className="text-base">{signals.trend === null ? "—" : TREND_LABEL[signals.trend]}</p>
          <p className="num text-xs text-ink-300">
            {signals.vs50 === null
              ? "50-day average unavailable"
              : `${signals.vs50 >= 0 ? "+" : ""}${(signals.vs50 * 100).toFixed(1)}% vs 50-day`}
          </p>
          <p className="num text-xs text-ink-300">
            {signals.vs200 === null
              ? "200-day average unavailable"
              : `${signals.vs200 >= 0 ? "+" : ""}${(signals.vs200 * 100).toFixed(1)}% vs 200-day`}
          </p>
        </Tile>
      </div>

      {series && series.dates.length > 1 && (
        <EntryLevelChart
          series={series}
          symbol={symbol}
          low={signals.rangeLow}
          high={signals.rangeHigh}
        />
      )}

      <SignalsExplainer />

      <p className="text-xs text-ink-500">
        From {signals.sessions} daily closes over the last year. Not advice — the four
        facts a chart would give you, kept in one place.
      </p>
    </div>
  );
}
