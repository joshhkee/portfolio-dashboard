"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@/lib/format";
import { convertCurrency, currencySymbol, currencyForRegion, type FxRates } from "@/lib/fx";

export default function PositionSizingCalculator({
  region,
  ticker: _ticker,
  currentPrice,
  targetBuyPrice,
  targetAllocPct,
  portfolioTotalSgd,
  fxRates,
}: {
  region: string;
  ticker: string;
  currentPrice: number | null;
  targetBuyPrice: number | null;
  targetAllocPct: number | null;
  portfolioTotalSgd: number;
  fxRates: FxRates;
}) {
  const symbol = currencySymbol[currencyForRegion(region)];

  // Default to targetBuyPrice if defined, otherwise currentPrice
  const effectivePrice = targetBuyPrice ?? currentPrice ?? 0;

  // If a target allocation is defined (e.g. 5%), precalculate suggested shares
  const initialShares = useMemo(() => {
    if (targetAllocPct && targetAllocPct > 0 && portfolioTotalSgd > 0 && effectivePrice > 0) {
      const targetSgd = portfolioTotalSgd * targetAllocPct;
      const targetNative = convertCurrency(targetSgd, "SG", currencyForRegion(region), fxRates);
      return Math.max(1, Math.round(targetNative / effectivePrice));
    }
    return 10;
  }, [targetAllocPct, portfolioTotalSgd, effectivePrice, region, fxRates]);

  const [sharesInput, setSharesInput] = useState<string>(String(initialShares));
  const [priceInput, setPriceInput] = useState<string>(
    effectivePrice > 0 ? String(effectivePrice) : ""
  );

  const shares = Number(sharesInput) > 0 ? Number(sharesInput) : 0;
  const price = Number(priceInput) > 0 ? Number(priceInput) : 0;

  const nativeOutlay = shares * price;
  const sgdOutlay = convertCurrency(nativeOutlay, region, "SGD", fxRates);

  // Resulting portfolio allocation % = (new SGD outlay) / (existing portfolio + new outlay)
  const resultingAllocPct =
    portfolioTotalSgd + sgdOutlay > 0 ? sgdOutlay / (portfolioTotalSgd + sgdOutlay) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Position Sizing Calculator
        </h4>
        <span className="text-[11px] text-ink-500">
          Portfolio: S${formatAmount(portfolioTotalSgd)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-ink-400">Shares</label>
          <input
            type="number"
            min="0"
            step="1"
            value={sharesInput}
            onChange={(e) => setSharesInput(e.target.value)}
            className="field min-h-[38px] text-xs font-mono"
            placeholder="Qty"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-ink-400">Entry Price ({symbol})</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="field min-h-[38px] text-xs font-mono"
            placeholder="Price"
          />
        </div>

        <div className="flex flex-col gap-0.5 justify-center rounded bg-ink-850 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Outlay</span>
          <p className="num text-xs font-medium text-ink-100">
            {symbol}{formatAmount(nativeOutlay)}
          </p>
          {region !== "SG" && (
            <p className="num text-[10px] text-ink-400">
              ≈ S${formatAmount(sgdOutlay)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-0.5 justify-center rounded bg-ink-850 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-500">Portfolio Share</span>
          <p className="num text-xs font-semibold text-accent">
            {(resultingAllocPct * 100).toFixed(1)}%
          </p>
          {targetAllocPct && (
            <p className="num text-[10px] text-ink-400">
              target: {(targetAllocPct * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
