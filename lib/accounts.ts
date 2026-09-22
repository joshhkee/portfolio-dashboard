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
// Every account still sees the same portfolio — an account is an IDENTITY
// (whose "since you last looked" is this, whose last visit is that) and not a
// lens on the data. What the roles added on 2026-09-23 change is who may
// create identities: an admin can, and everyone else has to ask.
//
// That makes one thing consequential that used to be harmless. Before roles,
// letting any account reset any other account's password cost nothing, because
// every account had the same reach. Now it would be a way around the queue
// entirely — reset the admin's password, sign in as them, approve yourself — so
// resetting someone ELSE's password is admin-only, and changing your own still
// needs your current password. The two rules are the same rule: the password is
// only ever changed by the person it belongs to, or by an admin on their behalf.

import { normalizeUsername } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

/** Either the action may proceed, or it may not and the caller should answer
 * with this status and message. */
export type Guard = { ok: true } | { ok: false; status: number; error: string };

/** The two roles, as the one comparison that reads them. "admin" is a string in
 *  the database rather than an enum, so this is where the string is interpreted. */
export type Role = "admin" | "member";

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

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
export function guardViewAccounts({
  hasAccount,
  accountCount,
}: {
  hasAccount: boolean;
  accountCount: number;
}): Guard {
  if (hasAccount) return { ok: true };
  if (accountCount === 0) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "Sign in with a username to see accounts — the shared password doesn't say who you are.",
  };
}

/**
 * May this visitor ACT on accounts — create one outright, approve or refuse a
 * request, reset a password, remove one?
 *
 * Admins only, plus the bootstrap. The bootstrap creates its first account as an
 * **admin** rather than a member, because an approval queue whose only member
 * cannot approve anything is a dead end; see `accountCreationDecision`.
 *
 * Being signed in is no longer enough, and that is the change: before roles, any
 * account holder could add and remove accounts.
 */
export function guardManageAccounts({
  role,
  accountCount,
}: {
  role: Role | null;
  accountCount: number;
}): Guard {
  if (isAdmin(role)) return { ok: true };
  if (role === null && accountCount === 0) return { ok: true };
  if (role === null) {
    return {
      ok: false,
      status: 403,
      error: "Sign in with a username to manage accounts — the shared password doesn't say who you are.",
    };
  }
  // Deliberately about the OBJECT rather than one verb: this same refusal
  // answers a member trying to create, approve, reset or remove, and a message
  // naming only one of those reads as a non-sequitur for the other three.
  return {
    ok: false,
    status: 403,
    error: "Only an admin can manage accounts.",
  };
}

/**
 * What a new account is, given who is asking.
 *
 *   admin      an admin added someone directly, so it is live immediately.
 *   bootstrap  nobody has an account yet, so the first one is created as an
 *              admin AND approved — otherwise there would be nobody who could
 *              ever approve anything.
 *   request    everybody else: created, but a request. It cannot sign in until
 *              an admin approves it.
 */
export type CreationDecision =
  | { status: "approved"; role: Role; because: "admin" | "bootstrap" }
  | { status: "pending"; role: Role; because: "request" };

export function accountCreationDecision({
  actorRole,
  accountCount,
}: {
  actorRole: Role | null;
  accountCount: number;
}): CreationDecision {
  if (isAdmin(actorRole)) return { status: "approved", role: "member", because: "admin" };
  if (accountCount === 0) return { status: "approved", role: "admin", because: "bootstrap" };
  return { status: "pending", role: "member", because: "request" };
}

/**
 * Approving a request.
 *
 * Admin only — this is the whole point of the queue — and only for something
 * that is actually still pending, so an approval cannot silently overwrite a
 * decision someone already made.
 */
export function guardReviewRequest({
  role,
  alreadyApproved,
}: {
  role: Role | null;
  alreadyApproved: boolean;
}): Guard {
  if (!isAdmin(role)) {
    return { ok: false, status: 403, error: "Only an admin can approve account requests." };
  }
  if (alreadyApproved) {
    return { ok: false, status: 400, error: "That account has already been approved." };
  }
  return { ok: true };
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
export function guardDeleteAccount({
  actorId,
  targetId,
  accountCount,
  removingAdmin,
  adminCount,
}: {
  actorId: number | null;
  targetId: number;
  accountCount: number;
  /** True when the account being removed is an admin. */
  removingAdmin: boolean;
  /** How many admins exist right now, including that one. */
  adminCount: number;
}): Guard {
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
  // The same dead end the bootstrap allowance exists to avoid: no admin means
  // nobody can approve a request ever again, and the queue fills up uselessly.
  if (removingAdmin && adminCount <= 1) {
    return {
      ok: false,
      status: 400,
      error: "That's the only admin. Make another account an admin before removing this one.",
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
  isAdmin: actorIsAdmin,
  currentSupplied,
  currentMatches,
}: {
  isSelf: boolean;
  /** Whether the person asking is an admin — only consulted on someone else's
   *  account, because resetting one is how you would bypass the approval queue
   *  without ever asking for it. */
  isAdmin: boolean;
  currentSupplied: boolean;
  currentMatches: boolean;
}): Guard {
  if (!isSelf) {
    if (!actorIsAdmin) {
      return {
        ok: false,
        status: 403,
        error: "Only an admin can reset someone else's password.",
      };
    }
    return { ok: true };
  }
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
