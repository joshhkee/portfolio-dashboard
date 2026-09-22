"use client";

import { useState } from "react";
import type { AlphaBetaResult, BenchmarkVerdict } from "@/lib/benchmarks";

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

/**
 * The plain-English reading of the benchmark statistics above it.
 *
 * Collapsible rather than always-open, because it is several paragraphs of
 * commentary. Hover-only was rejected: a tooltip is unreachable on touch and
 * impossible to re-read a sentence from, whereas a real disclosure with
 * `aria-expanded` works for keyboard, touch and screen readers alike.
 *
 * Every number in here is derived from the same figures the chart draws, so the
 * explanation cannot drift from the chart.
 */
export default function BenchmarkExplainer({
  verdict,
  stats,
  benchmarkLabel,
  windowLabel,
}: {
  verdict: BenchmarkVerdict;
  stats: AlphaBetaResult;
  benchmarkLabel: string;
  windowLabel: string;
}) {
  const [open, setOpen] = useState(false);

  const gapPoints = Math.abs(verdict.difference * 100).toFixed(1);
  const alphaPoints = Math.abs(verdict.alphaContribution * 100).toFixed(1);

  return (
    <div className="panel border-ink-700 bg-ink-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="benchmark-explainer"
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs text-ink-300 transition hover:text-ink-100 motion-reduce:transition-none"
      >
        <span className="min-w-0">
          <span className={verdict.outperformedBenchmark ? "text-gain" : "text-loss"}>
            {verdict.outperformedBenchmark ? "Ahead of" : "Behind"} {benchmarkLabel}
          </span>
          <span className="text-ink-300"> over this window</span>
          <span className="text-ink-500"> — what alpha, beta and R² mean</span>
        </span>
        <span className="shrink-0 text-ink-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div
          id="benchmark-explainer"
          className="flex flex-col gap-3 border-t border-ink-700 px-4 py-3 text-xs leading-relaxed text-ink-300"
        >
          <p>
            Over {windowLabel} the portfolio returned{" "}
            <span className="num text-ink-100">{formatPct(verdict.portfolioReturn)}</span> once
            deposits are removed, against{" "}
            <span className="num text-ink-100">{formatPct(verdict.benchmarkReturn)}</span> for{" "}
            {benchmarkLabel} — so it{" "}
            {verdict.outperformedBenchmark ? "outperformed by" : "lagged by"}{" "}
            <span
              className={`num ${verdict.outperformedBenchmark ? "text-gain" : "text-loss"}`}
            >
              {gapPoints} points
            </span>
            .
          </p>

          <p>
            Beta {stats.beta.toFixed(2)} means a 1% move in {benchmarkLabel} has historically moved
            this portfolio about{" "}
            <span className="num text-ink-100">{(stats.beta * 100).toFixed(0)}%</span>. Applied to the
            index&apos;s {formatPct(verdict.benchmarkReturn)}, that alone predicts roughly{" "}
            <span className="num text-ink-100">{formatPct(verdict.expectedFromBeta)}</span>; the
            portfolio actually returned {formatPct(verdict.portfolioReturn)}, so{" "}
            <span
              className={`num ${verdict.beatBetaExpectation ? "text-gain" : "text-loss"}`}
            >
              {alphaPoints} points came from
            </span>{" "}
            something other than market exposure
            {verdict.beatBetaExpectation ? " in the portfolio's favour" : " against it"}. The alpha
            above is the precise, annualized version of this (
            {formatPct(stats.alphaAnnual)}).
          </p>

          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
              <span className="text-ink-100">Alpha</span> — the return left over after removing what
              market exposure explains. Positive is ahead of what this beta predicts; negative is
              behind it.
            </li>
            <li>
              <span className="text-ink-100">Beta</span> — sensitivity to the index. Below 1 means
              less market risk than the index carries, which a large cash balance and the SG/HK
              holdings (not in this index) both produce.
            </li>
            <li>
              <span className="text-ink-100">R²</span> — how much of the portfolio&apos;s daily
              movement the index explains. {stats.r2.toFixed(2)} means most day-to-day movement is{" "}
              <em>not</em> the index, so read alpha and beta as approximations rather than facts.
            </li>
            <li>
              <span className="text-ink-100">Correlation</span> — the same relationship with a
              sign.{" "}
              {stats.correlation.toFixed(2)} means they tend to move together, but loosely.
            </li>
          </ul>

          <p className="text-ink-500">
            Measured over {windowLabel} ({stats.n} overlapping days). A window this short is noisy,
            so treat it as a direction rather than a verdict; cash never appears in the index, so a
            large cash balance mechanically lowers beta and moves alpha.
          </p>
        </div>
      )}
    </div>
  );
}
