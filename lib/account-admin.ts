// The facts the rules in lib/accounts.ts need, resolved.
//
// The routes, the accounts page and the root layout all ask the same two
// questions — may this visitor SEE accounts, and may they ACT on them — and it
// would be four copies of the same logic if each answered it itself. It lives
// here instead, so there is one place where "may they" is decided and one place
// to read when asking why a request was refused.
//
// Server-only: it reads the cookie store and the database, so it must never be
// imported by middleware (Edge runtime, no Prisma).

import { prisma } from "@/lib/prisma";
import { readAccount, type SignedInAccount } from "@/lib/session";
import {
  guardManageAccounts,
  guardViewAccounts,
  type Guard,
  type Role,
} from "@/lib/accounts";

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
  role: true,
  approvedAt: true,
} as const;

export interface AccountSummary {
  id: number;
  username: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  role: string;
  /** Null means the account is a pending request. */
  approvedAt: Date | null;
}

export interface AccountAdminContext {
  /** The live account behind the cookie. Null for the shared-password gate
   * (which carries no identity) and for the bootstrap state. */
  me: SignedInAccount | null;
  /** The caller's role, or null when there is no account behind the cookie. */
  role: Role | null;
  /** Whether this visitor may see the accounts surface. */
  view: Guard;
  /** Whether this visitor may create, approve, refuse, reset or remove. */
  manage: Guard;
}

/** Narrow a stored role string to the two the rules know about. Anything else
 *  (a hand-edited row, a future third role) reads as a member, which is the
 *  safe direction: it grants nothing. */
function toRole(value: string | null | undefined): Role | null {
  if (value === "admin") return "admin";
  if (value === "member") return "member";
  return null;
}

/**
 * Resolve who is asking and what they may do.
 *
 * The count is asked for ONLY when nobody is signed in, because that is the
 * only case it decides: an account holder's permissions come from their role,
 * while a visitor with no account needs the count to know whether they are
 * looking at the bootstrap or at a dashboard that already has identities. The
 * root layout calls this on every page, so the query it does not run is the one
 * the owner pays for on every page load.
 *
 * Never throws, and never allows by accident: a database hiccup resolves to a
 * refusal rather than a 500 (failing a whole page over a nav link would be the
 * worse trade), and the refusal is returned directly rather than falling through
 * to the guards, where an unreachable count of 0 would look like the bootstrap.
 */
export async function accountAdminContext(): Promise<AccountAdminContext> {
  try {
    const me = await readAccount();
    if (me) {
      const role = toRole(me.role);
      return {
        me,
        role,
        view: guardViewAccounts({ hasAccount: true, accountCount: 1 }),
        manage: guardManageAccounts({ role, accountCount: 1 }),
      };
    }

    const accountCount = await prisma.user.count();
    return {
      me: null,
      role: null,
      view: guardViewAccounts({ hasAccount: false, accountCount }),
      manage: guardManageAccounts({ role: null, accountCount }),
    };
  } catch {
    const refusal: Guard = {
      ok: false,
      status: 503,
      error: "Couldn't read the account list just now.",
    };
    return { me: null, role: null, view: refusal, manage: refusal };
  }
}

/** How many accounts exist. Only deletion needs the number — see
 * guardDeleteAccount — so it is fetched where it is used rather than on every
 * page. */
export async function countAccounts(): Promise<number> {
  return prisma.user.count();
}

/** How many admins exist. Deletion and approval both need it, and it is the
 * number that decides whether an action would leave nobody able to approve. */
export async function countAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "admin", approvedAt: { not: null } } });
}

/** How many requests are waiting.
 *
 * Asked for ONLY where the answer is shown to someone who can act on it — the
 * accounts page, and the Today header, both of which are admin-facing — because
 * it is a second query on a page that already resolves a session, and an admin
 * is not the only person who opens the dashboard. */
export async function countRequests(): Promise<number> {
  return prisma.user.count({ where: { approvedAt: null } });
}

/** Approved accounts, and the requests waiting on one. Two lists rather than
 * one list with a flag, because they are two different jobs: people who can sign
 * in, and a queue. */
export async function listAccounts(): Promise<AccountSummary[]> {
  return prisma.user.findMany({
    select: ACCOUNT_LIST_SELECT,
    orderBy: { username: "asc" },
  });
}
