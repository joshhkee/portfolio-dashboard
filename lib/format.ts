// Pure number formatting — no JSX, no React.
//
// These two live here rather than beside the components in
// `components/SignedNumber.tsx` because server-side modules need them too:
// `lib/notes.ts` composes a ledger row's derived summary out of an amount and a
// quantity. A `lib/*` module importing from `components/*` points the
// dependency arrow the wrong way, and the alternative — a second copy of
// `toLocaleString` — is the kind of duplication that drifts.
//
// `SignedNumber` re-exports both, so every existing call site is unchanged.

/** Caps qty display at 4 decimal places without padding whole numbers with
 * trailing zeros (10 -> "10", 10.5 -> "10.5", not "10.0000"). */
export function formatQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Comma-formatted amount with exactly 2 decimals, no symbol or sign — for
 * composing with a currency symbol that's already handled separately, e.g.
 * `{symbol}{formatAmount(price)}`. Same underlying formatting Money/NativeMoney
 * use, for always-positive figures like a price or avg cost that don't need
 * their sign/color logic. */
export function formatAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
