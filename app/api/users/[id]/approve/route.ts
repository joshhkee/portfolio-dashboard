import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountAdminContext } from "@/lib/account-admin";
import { guardReviewRequest } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/**
 * Approve a pending account request: the one action that turns a request into an
 * account.
 *
 * Admin only — `guardReviewRequest` is the rule, and it is a rule rather than an
 * inline check so the refusal has one wording and the tests can pin it. The row
 * has existed since the request was made (with the requester's own hashed
 * password), so approving is a stamp, not a creation: nobody has to hand a
 * password around, and the requester signs in with what they already chose.
 *
 * A request that was already approved answers 400 rather than being re-stamped,
 * so a double-click cannot rewrite when someone was let in.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { role } = await accountAdminContext();

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, approvedAt: true },
  });
  if (!target) return NextResponse.json({ error: "No such account" }, { status: 404 });

  const allowed = guardReviewRequest({ role, alreadyApproved: target.approvedAt !== null });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  await prisma.user.update({ where: { id }, data: { approvedAt: new Date() } });
  return NextResponse.json({ ok: true, username: target.username });
}
