interface Cashflow {
  amount: number; // negative = money in (a contribution), positive = money out (current value)
  date: Date;
}

/** Money-weighted annualized return across irregular cashflows — the
 * same calculation Excel/Sheets' XIRR() does. Unlike a simple
 * lump-sum CAGR (current value / total invested, annualized from a
 * single inception date), this actually accounts for WHEN each
 * contribution landed, which matters when contributions are spread
 * out over time rather than made all at once.
 *
 * Pass each contribution as a negative amount on its actual date, plus
 * one final positive cashflow for the current portfolio value as of
 * today. Returns null if there isn't enough data to solve (fewer than
 * two distinct dates) or the solver doesn't converge to a plausible
 * rate. */
export function xirr(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) return null;
  const t0 = cashflows[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365.25 * 86400000);
  if (cashflows.every((cf) => years(cf.date) === 0)) return null;

  function npv(rate: number): number {
    return cashflows.reduce((sum, cf) => sum + cf.amount / Math.pow(1 + rate, years(cf.date)), 0);
  }
  function npvDerivative(rate: number): number {
    return cashflows.reduce((sum, cf) => {
      const t = years(cf.date);
      return t === 0 ? sum : sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);
  }

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const fPrime = npvDerivative(rate);
    if (Math.abs(fPrime) < 1e-10) break;
    const next = rate - f / fPrime;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      break;
    }
    rate = next;
  }

  // Reject implausible results (non-convergence tends to blow up
  // rather than settle near a reasonable rate) rather than show a
  // meaningless number.
  if (!Number.isFinite(rate) || Math.abs(rate) > 10) return null;
  return rate;
}
