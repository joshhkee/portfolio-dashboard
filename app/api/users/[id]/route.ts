import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountAdminContext, countAccounts, countAdmins } from "@/lib/account-admin";
import { guardDeleteAccount, guardSetPassword, isAdmin } from "@/lib/accounts";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/**
 * Change one account's password.
 *
 * On your own account the current password is required; on someone else's it is
 * not, because a forgotten password has no other recovery path here — there is
 * no email to send a reset to. The rule and its reasoning are in
 * lib/accounts.ts's `guardSetPassword`.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { me, role, view } = await accountAdminContext();
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const problem = validatePassword(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "No such account" }, { status: 404 });

  const isSelf = me !== null && me.id === target.id;
  const currentSupplied =
    typeof body?.currentPassword === "string" && body.currentPassword !== "";
  const allowed = guardSetPassword({
    isSelf,
    // Resetting someone else's password would otherwise be a way around the
    // approval queue: take over the admin, approve yourself.
    isAdmin: isAdmin(role),
    currentSupplied,
    // Only consulted when it is their own account, so an absent current
    // password on someone else's does not run a pointless hash.
    currentMatches: isSelf
      ? verifyPassword(String(body?.currentPassword ?? ""), target.passwordHash)
      : true,
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(password) },
  });

  return NextResponse.json({ ok: true, username: target.username });
}

/**
 * Remove an account — or refuse a request, which is the same operation.
 *
 * Admin only. Then: you cannot remove the one you are signed in as, the last
 * account cannot go, and neither can the last ADMIN — the same dead end the
 * bootstrap allowance exists to avoid, since a queue with nobody able to approve
 * fills up and stays full. See guardDeleteAccount.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { me, manage } = await accountAdminContext();
  if (!manage.ok) return NextResponse.json({ error: manage.error }, { status: manage.status });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "No such account" }, { status: 404 });

  const allowed = guardDeleteAccount({
    actorId: me?.id ?? null,
    targetId: target.id,
    accountCount: await countAccounts(),
    removingAdmin: isAdmin(target.role) && target.approvedAt !== null,
    adminCount: await countAdmins(),
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
