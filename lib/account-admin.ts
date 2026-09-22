// The facts the rules in lib/accounts.ts need, resolved.
//
// The routes, the accounts page and the root layout all ask the same question —
// may this visitor manage accounts — and it would be three copies of the same
// logic if each answered it itself. It lives here instead, so there is one place
// where "may they" is decided and one place to read when asking why a request
// was refused.
//
// Server-only: it reads the cookie store and the database, so it must never be
// imported by middleware (Edge runtime, no Prisma).

import { prisma } from "@/lib/prisma";
import { readAccount, type SignedInAccount } from "@/lib/session";
import { guardManageAccounts, type Guard } from "@/lib/accounts";

/** The columns an account is listed by — never `passwordHash`.
 *
 * One definition, used by the list route and the page, so a new sensitive column
 * cannot start leaking because one of the queries was written as a bare
 * `findMany()` before it existed.
 */
export const ACCOUNT_LIST_SELECT = {
  id: true,
  username: true,
  createdAt: true,
  lastSeenAt: true,
} as const;

export interface AccountSummary {
  id: number;
  username: string;
  createdAt: Date;
  lastSeenAt: Date | null;
}

export interface AccountAdminContext {
  /** The live account behind the cookie. Null for the shared-password gate
   * (which carries no identity) and for the bootstrap state. */
  me: SignedInAccount | null;
  /** Whether this visitor may manage accounts. */
  guard: Guard;
}

/**
 * Resolve who is asking and whether they may manage accounts.
 *
 * The count is asked for ONLY when nobody is signed in, because that is the
 * only case it decides: an account holder may always manage accounts, while a
 * visitor with no account needs the count to know whether they are looking at
 * the bootstrap or at a dashboard that already has identities. The root layout
 * calls this on every page, so the query it does not run is the one the owner
 * pays for on every page load.
 *
 * Never throws, and never allows by accident: a database hiccup resolves to a
 * refusal rather than a 500 (failing a whole page over a nav link would be the
 * worse trade), and the refusal is returned directly rather than falling through
 * to the guard, where an unreachable count of 0 would look like the bootstrap.
 */
export async function accountAdminContext(): Promise<AccountAdminContext> {
  try {
    const me = await readAccount();
    if (me) return { me, guard: guardManageAccounts(true, 1) };

    const accountCount = await prisma.user.count();
    return { me: null, guard: guardManageAccounts(false, accountCount) };
  } catch {
    return {
      me: null,
      guard: { ok: false, status: 503, error: "Couldn't read the account list just now." },
    };
  }
}

/** How many accounts exist. Only deletion needs the number — see
 * guardDeleteAccount — so it is fetched where it is used rather than on every
 * page. */
export async function countAccounts(): Promise<number> {
  return prisma.user.count();
}

/** The account list, alphabetical. */
export async function listAccounts(): Promise<AccountSummary[]> {
  return prisma.user.findMany({
    select: ACCOUNT_LIST_SELECT,
    orderBy: { username: "asc" },
  });
}
