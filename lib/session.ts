// Who is looking at the dashboard, and when they last did.
//
// Node-only, unlike lib/auth.ts: this reads the cookie store and the database,
// so it must never be imported by middleware (which runs on the Edge runtime
// with no Prisma client). Keep the split — token PARSING is edge-safe and lives
// in lib/auth.ts; resolving a token to a person is here.
//
// Note on the shared-password gate: it carries no identity, so a visit through
// it returns `account: null` and `previousSeenAt: null`. Callers must treat that
// as "unknown" rather than "just now" — the difference is the difference between
// a dashboard that can say what changed while you were away and one that
// silently claims nothing ever does.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE_NAME, readSessionToken } from "@/lib/auth";

/** How stale the stored last-seen has to be before a visit rewrites it.
 *
 * Without this, every request would be a write. With it, the "since you last
 * looked" line compares against a moment at least this old, which also stops
 * the figure from visibly shrinking as someone refreshes the page. */
const TOUCH_AFTER_MS = 10 * 60 * 1000;

export interface SignedInAccount {
  id: number;
  username: string;
}

export interface VisitContext {
  /** Null when signed in through the shared password, or not signed in at all. */
  account: SignedInAccount | null;
  /**
   * When this person was last here BEFORE this visit. Null when there is no
   * account to attribute it to — callers fall back to "the last recorded day"
   * rather than inventing a baseline.
   */
  previousSeenAt: Date | null;
}

/**
 * Resolve the current visit, touching lastSeenAt when it is stale.
 *
 * Fails soft at every step: an unreadable cookie, an unknown user or a database
 * error all resolve to "no account", because a dashboard that 500s over a
 * last-seen bookkeeping row would be trading the whole page for a caption.
 */
export async function readVisit(): Promise<VisitContext> {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    const session = await readSessionToken(token);
    if (!session) return { account: null, previousSeenAt: null };

    const user = await prisma.user.findUnique({ where: { username: session.username } });
    if (!user) return { account: null, previousSeenAt: null };

    const previousSeenAt = user.lastSeenAt;
    const now = new Date();
    if (!previousSeenAt || now.getTime() - previousSeenAt.getTime() > TOUCH_AFTER_MS) {
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: now } });
    }

    return { account: { id: user.id, username: user.username }, previousSeenAt };
  } catch {
    return { account: null, previousSeenAt: null };
  }
}

/** Record a sign-in, so the first dashboard load after it reads "since you
 * logged in" rather than the time of a previous session. */
export async function markSeen(userId: number, at: Date = new Date()): Promise<void> {
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: at } });
  } catch {
    // Never let bookkeeping fail a successful login.
  }
}
