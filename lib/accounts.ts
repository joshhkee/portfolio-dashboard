// Who may manage accounts, and what a new account may look like.
//
// Pure, and separate from the routes for the reason lib/schedule.ts is separate
// from the Outlay page: these are the decisions a reviewer would want pinned by
// tests — can someone delete the last account? does the bootstrap allowance
// leave a hole open forever? — and a route handler is the worst place to ask,
// because exercising it needs a database, a cookie and a request object. The
// routes resolve the facts (who is signed in, how many accounts exist, does this
// password verify) and hand them here; nothing in this file touches Prisma,
// cookies or the request.
//
// The model is deliberately flat: every account sees the same portfolio, so an
// account is an IDENTITY — whose "since you last looked" is this, whose last
// visit is that — and NOT a permission level. Nothing here grants access to
// data; the shared gate and any account reach the same dashboard. What these
// rules protect is the identity layer itself: that managing accounts can never
// lock everybody out, and that a password change cannot be made on someone's
// behalf without their current password when it is their own.

import { normalizeUsername } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

/** Either the action may proceed, or it may not and the caller should answer
 * with this status and message. */
export type Guard = { ok: true } | { ok: false; status: number; error: string };

/**
 * May this visitor open the accounts surface at all?
 *
 * Two ways in:
 *   1. They are signed in as an account — the normal case.
 *   2. There are no accounts yet. This is the bootstrap: the dashboard starts
 *      life behind the shared password with no identities, and without this
 *      allowance the page would be unreachable until somebody ran
 *      `npm run user:add` in a shell, which is precisely the errand a UI is for.
 *
 * The bootstrap closes for good as soon as one account exists, and
 * `guardDeleteAccount` is what keeps it closed: the last account cannot be
 * deleted, so the count can never fall back to zero and quietly reopen a page
 * that lets anyone with the shared password mint an identity.
 */
export function guardManageAccounts(hasAccount: boolean, accountCount: number): Guard {
  if (hasAccount) return { ok: true };
  if (accountCount === 0) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "Sign in with a username to manage accounts — the shared password doesn't say who you are.",
  };
}

/**
 * Deleting someone.
 *
 * You cannot delete the account you are signed in as: the page's own actions are
 * attributed to it, and doing so would end your session on the next request with
 * no explanation beyond a login screen. The last account cannot go either — the
 * dashboard would lose the identities it records visits against, and the
 * bootstrap allowance would reopen.
 */
export function guardDeleteAccount(
  actorId: number | null,
  targetId: number,
  accountCount: number
): Guard {
  if (actorId !== null && actorId === targetId) {
    return {
      ok: false,
      status: 400,
      error: "That's the account you're signed in as — sign in as another one to remove it.",
    };
  }
  if (accountCount <= 1) {
    return {
      ok: false,
      status: 400,
      error: "That's the only account. Add another before removing this one.",
    };
  }
  return { ok: true };
}

/**
 * Setting a password.
 *
 * On your OWN account the current password is required — a stolen session should
 * not be enough to lock the owner out of their account. On someone else's it is
 * not, because an account holder resetting a forgotten password IS the recovery
 * path: there is no email, so the alternative would be a shell on the server.
 * Accounts are peers here, so this grants no extra reach: resetting a password
 * only lets you sign in as a person who already sees the same dashboard.
 */
export function guardSetPassword({
  isSelf,
  currentSupplied,
  currentMatches,
}: {
  isSelf: boolean;
  currentSupplied: boolean;
  currentMatches: boolean;
}): Guard {
  if (!isSelf) return { ok: true };
  if (!currentSupplied) {
    return { ok: false, status: 400, error: "Enter your current password to change it." };
  }
  if (!currentMatches) {
    return { ok: false, status: 401, error: "That isn't your current password." };
  }
  return { ok: true };
}

/**
 * The username rule as a phrase that completes the sentence "Usernames are
 * …".
 *
 * A constant rather than prose in two places: it is both the error the API
 * returns and the hint the form shows under the field, and a hint that says
 * something the validator disagrees with is worse than no hint at all.
 */
export const USERNAME_RULE =
  '2–32 characters, starting with a letter or digit, using only letters, digits, "-" and "_"';

export interface NewAccount {
  username: string;
  password: string;
}

export type ParsedAccount = { ok: true; value: NewAccount } | { ok: false; error: string };

/**
 * Read a new account out of a request body.
 *
 * The same two rules the CLI enforces (lib/auth's `normalizeUsername`,
 * lib/password's `validatePassword`), called rather than restated, so the form
 * cannot start accepting something the script would have refused. The messages
 * are the ones the form shows, which is why they are sentences.
 */
export function parseNewAccount(body: unknown): ParsedAccount {
  const raw = (body ?? {}) as Record<string, unknown>;

  const username = normalizeUsername(typeof raw.username === "string" ? raw.username : "");
  if (!username) {
    return { ok: false, error: `Usernames are ${USERNAME_RULE}.` };
  }

  const password = typeof raw.password === "string" ? raw.password : "";
  const problem = validatePassword(password);
  if (problem) return { ok: false, error: problem };

  return { ok: true, value: { username, password } };
}
