// Currency handling.
//
// Your transactions are recorded in each market's native currency
// (US -> USD, SG -> SGD, HK -> HKD). That's correct for per-trade
// figures, but anything that SUMS across regions (total realized P/L
// on Completed Trades, combined "Total Holdings" / portfolio % on the
// SG/HK positions page) needs every amount converted to one currency
// first — otherwise you're adding SGD and HKD together as if they were
// equal, which is meaningless. This module fetches live FX rates and
// does that conversion, in USD terms since that's your base currency.

import { fetchQuote } from "@/lib/prices";

export type Currency = "USD" | "SGD" | "HKD";

export const regionCurrency: Record<string, Currency> = {
  US: "USD",
  SG: "SGD",
  HK: "HKD",
};

export const currencySymbol: Record<Currency, string> = {
  USD: "US$",
  SGD: "S$",
  HKD: "HK$",
};

export function currencyForRegion(region: string): Currency {
  return regionCurrency[region] ?? "USD";
}

export type FxRates = Record<"SGD" | "HKD", number>;

// Fallbacks only kick in if the live quote fails — better to show a
// roughly-right USD total than to crash the page.
const FALLBACK_RATES: FxRates = { SGD: 1.35, HKD: 7.8 };

/** Units of foreign currency per 1 USD, e.g. { SGD: 1.35, HKD: 7.8 }. */
export async function fetchFxRates(): Promise<FxRates> {
  const [sgd, hkd] = await Promise.all([fetchQuote("SGD=X"), fetchQuote("HKD=X")]);
  return {
    SGD: sgd ?? FALLBACK_RATES.SGD,
    HKD: hkd ?? FALLBACK_RATES.HKD,
  };
}

/**
 * SGD per ONE unit of `currency`, from the USD-based rate pair.
 *
 * FxRates are quoted the way Yahoo quotes them — units of FOREIGN currency per
 * 1 USD (SGD=X = 1.35 means 1 USD buys 1.35 SGD) — which is the opposite
 * direction from what the reporting side needs. Everything the exposure view
 * does is "what is this worth in SGD", so the direction is converted once,
 * here, instead of dividing by a rate at each call site and hoping the
 * direction was remembered correctly.
 *
 * Cross rates go through USD: SGD per HKD = (SGD per USD) / (HKD per USD).
 * Falls back to 1 rather than returning NaN or Infinity when a rate is
 * missing — a wrong-but-finite number is recoverable, a poisoned division
 * silently corrupts every total it touches.
 */
export function sgdPerUnit(currency: Currency, rates: FxRates): number {
  if (currency === "SGD") return 1;
  const sgdPerUsd = rates.SGD;
  const foreignPerUsd = currency === "USD" ? 1 : rates[currency];
  if (!foreignPerUsd || foreignPerUsd <= 0 || !sgdPerUsd || sgdPerUsd <= 0) return 1;
  return sgdPerUsd / foreignPerUsd;
}

export function toUSD(amount: number, region: string, rates: FxRates): number {
  const currency = currencyForRegion(region);
  if (currency === "USD") return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
}

/** Converts an amount from its region's native currency into any target
 * currency, via USD as the common base (rates are expressed as units of
 * foreign currency per 1 USD). */
export function convertCurrency(
  amount: number,
  fromRegion: string,
  toCurrency: Currency,
  rates: FxRates
): number {
  const usd = toUSD(amount, fromRegion, rates);
  if (toCurrency === "USD") return usd;
  const rate = rates[toCurrency];
  return rate ? usd * rate : usd;
}