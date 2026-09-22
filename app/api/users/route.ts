import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountAdminContext, listAccounts } from "@/lib/account-admin";
import { parseNewAccount } from "@/lib/accounts";
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

/** The accounts that can sign in. Never returns a hash. */
export async function GET() {
  const { guard } = await accountAdminContext();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  return NextResponse.json({ users: await listAccounts() });
}

/**
 * Create an account.
 *
 * The rules are lib/accounts.ts's `parseNewAccount` — the same two the CLI
 * enforces — so the form and `npm run user:add` cannot drift into accepting
 * different things. The password is hashed here and never stored, echoed or
 * logged.
 */
export async function POST(req: NextRequest) {
  const { guard } = await accountAdminContext();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = parseNewAccount(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { username, password } = parsed.value;

  // Pre-checked for the common case so the answer is a plain 409 rather than a
  // database error; the catch below is what makes it correct under a race,
  // where two creates pass the check and the second one hits the unique index.
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: `"${username}" is already taken.` }, { status: 409 });
  }

  try {
    const user = await prisma.user.create({
      data: { username, passwordHash: hashPassword(password) },
      select: { id: true, username: true, createdAt: true, lastSeenAt: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: `"${username}" is already taken.` }, { status: 409 });
    }
    throw error;
  }
}
