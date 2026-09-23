import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  accountAdminContext,
  countAccounts,
  countRequests,
  listAccounts,
} from "@/lib/account-admin";
import {
  accountCreationDecision,
  guardRequestAccount,
  parseNewAccount,
} from "@/lib/accounts";
import { hashPassword } from "@/lib/password";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { hasSharedGate } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Throttle for the ONE unauthenticated path into this endpoint.
 *
 * A request per hour was never the plan; this exists because the request path
 * is public (the login page has to be able to ask on a stranger's behalf), and
 * anything public that writes a row is something to rate limit. Every attempt
 * counts, not just the failed ones — a queue is filled by successes — so this is
 * checked and charged before the payload is even parsed.
 */
const requestLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
});

/** True for Prisma's unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** The accounts that can sign in, and the requests waiting on a decision.
 *  Never returns a hash. */
export async function GET() {
  const { view } = await accountAdminContext();
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });

  const accounts = await listAccounts();
  return NextResponse.json({
    users: accounts.filter((a) => a.approvedAt !== null),
    requests: accounts.filter((a) => a.approvedAt === null),
  });
}

/**
 * Create an account, or ask for one.
 *
 * Which of the two happens is decided by `accountCreationDecision`, not by a
 * flag in the request body: an admin's create is live immediately, the very
 * first account on an empty database becomes an admin and is live, and anyone
 * else's arrives as a request that cannot sign in until an admin approves it.
 * Taking it from who is asking rather than from what they sent is what stops a
 * request from promoting itself.
 *
 * This route is reachable WITHOUT a session, which is a change: the login page
 * offers "request an account" to people who by definition cannot sign in, so
 * requiring a session here made asking impossible for exactly the people the
 * feature is for. What keeps that safe is that the outcome is not decided by
 * the caller:
 *
 *   * a stranger can only create a PENDING row — it cannot sign in, so it is
 *     inert, and an admin has to look at it before it becomes anything;
 *   * the bootstrap (the first account, which is created as a live admin) is the
 *     one outcome that grants rather than requests, so it still requires the
 *     shared-password gate — see `hasSharedGate`;
 *   * the unauthenticated path is charged to the address and capped by a finite
 *     queue (`guardRequestAccount`), so it cannot be used to fill the table.
 *
 * The rules for the name and password are lib/accounts.ts's `parseNewAccount` —
 * the same two the CLI enforces — so the form and `npm run user:add` cannot
 * drift into accepting different things. The password is hashed here and never
 * stored, echoed or logged. A requester chooses their own password up front so
 * approval never involves passing a secret around out of band.
 */
export async function POST(req: NextRequest) {
  const { me, role } = await accountAdminContext();
  const accountCount = await countAccounts();
  const decision = accountCreationDecision({ actorRole: role, accountCount });

  // The one decision on this endpoint that hands out access: no accounts exist,
  // so this create is an approved ADMIN. Reachable anonymously, that would let a
  // stranger claim a fresh deployment, so it keeps the gate.
  if (decision.because === "bootstrap" && !(await hasSharedGate())) {
    return NextResponse.json(
      { error: "Create the first account from the dashboard, signed in with the shared password." },
      { status: 403 }
    );
  }

  // No identity behind the request means the public path, and it is the only one
  // that can be walked by someone who has never been let in.
  if (decision.status === "pending" && me === null) {
    const ip = clientIp(req);
    const rate = requestLimiter.check(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Too many account requests from this address — try again in ${Math.ceil(
            rate.retryAfterSec / 60
          )} min`,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
      );
    }
    requestLimiter.recordFailure(ip);

    const capacity = guardRequestAccount({ pendingCount: await countRequests() });
    if (!capacity.ok) {
      return NextResponse.json({ error: capacity.error }, { status: capacity.status });
    }
  }

  const parsed = parseNewAccount(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { username, password } = parsed.value;

  // Pre-checked for the common case so the answer is a plain 409 rather than a
  // database error; the catch below is what makes it correct under a race,
  // where two creates pass the check and the second one hits the unique index.
  // The pending wording is deliberately different from the taken wording: half
  // the point of a queue is that the person learns they are already in it.
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const taken = existing.approvedAt
      ? `"${username}" is already taken.`
      : `"${username}" has already been requested and is waiting for approval.`;
    return NextResponse.json({ error: taken }, { status: 409 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: decision.role,
        approvedAt: decision.status === "approved" ? new Date() : null,
      },
      select: { id: true, username: true, createdAt: true, lastSeenAt: true },
    });
    return NextResponse.json({ user, status: decision.status }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: `"${username}" is already taken.` }, { status: 409 });
    }
    throw error;
  }
}
