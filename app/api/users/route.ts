import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountAdminContext, countAccounts, listAccounts } from "@/lib/account-admin";
import { accountCreationDecision, parseNewAccount } from "@/lib/accounts";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

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
 * The rules for the name and password are lib/accounts.ts's `parseNewAccount` —
 * the same two the CLI enforces — so the form and `npm run user:add` cannot
 * drift into accepting different things. The password is hashed here and never
 * stored, echoed or logged. A requester chooses their own password up front so
 * approval never involves passing a secret around out of band.
 */
export async function POST(req: NextRequest) {
  const { role, view } = await accountAdminContext();
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });

  const parsed = parseNewAccount(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { username, password } = parsed.value;

  // Seeing the accounts surface is enough to ASK for one; the decision below is
  // what separates asking from being given.
  const decision = accountCreationDecision({
    actorRole: role,
    accountCount: await countAccounts(),
  });

  // Pre-checked for the common case so the answer is a plain 409 rather than a
  // database error; the catch below is what makes it correct under a race,
  // where two creates pass the check and the second one hits the unique index.
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
