import { describe, it, expect } from "vitest";
import {
  accountCreationDecision,
  guardDeleteAccount,
  guardManageAccounts,
  guardRequestAccount,
  guardReviewRequest,
  guardSetPassword,
  guardViewAccounts,
  isAdmin,
  MAX_PENDING_REQUESTS,
  parseNewAccount,
  USERNAME_RULE,
  type Guard,
} from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/password";

/** Asserts a refusal and hands back the message, without the narrowing dance
 * each time. */
function refusal(guard: Guard): string {
  expect(guard.ok).toBe(false);
  return guard.ok ? "" : guard.error;
}

describe("isAdmin", () => {
  it("reads exactly one string as admin, and nothing else", () => {
    expect(isAdmin("admin")).toBe(true);
    for (const value of ["member", "Admin", " ADMIN ", "", null, undefined]) {
      expect(isAdmin(value)).toBe(false);
    }
  });
});

describe("guardViewAccounts", () => {
  it("lets any signed-in account see the page, whatever their role", () => {
    expect(guardViewAccounts({ hasAccount: true, accountCount: 5 }).ok).toBe(true);
  });

  it("allows the bootstrap, so the first account does not need a shell", () => {
    expect(guardViewAccounts({ hasAccount: false, accountCount: 0 }).ok).toBe(true);
  });

  it("refuses the shared password once any account exists", () => {
    const guard = guardViewAccounts({ hasAccount: false, accountCount: 1 });
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toContain("username");
  });
});

describe("guardManageAccounts", () => {
  it("lets an admin manage accounts", () => {
    expect(guardManageAccounts({ role: "admin", accountCount: 9 }).ok).toBe(true);
  });

  it("allows the bootstrap: no accounts at all, so the first one can be created", () => {
    // Without this the page would be unreachable until somebody ran the CLI.
    expect(guardManageAccounts({ role: null, accountCount: 0 }).ok).toBe(true);
  });

  it("refuses a member — being signed in is no longer enough", () => {
    const guard = guardManageAccounts({ role: "member", accountCount: 2 });
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toBe("Only an admin can manage accounts.");
  });

  it("refuses the shared password once any account exists", () => {
    const guard = guardManageAccounts({ role: null, accountCount: 1 });
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toContain("username");
  });
});

describe("accountCreationDecision", () => {
  it("makes an admin's create live, as a member", () => {
    // Membership, not admin: an admin adding somebody does not hand out admin
    // with it, or one careless create would be a second approver.
    expect(accountCreationDecision({ actorRole: "admin", accountCount: 3 })).toEqual({
      status: "approved",
      role: "member",
      because: "admin",
    });
  });

  it("makes the very first account an approved admin", () => {
    // The dead end this avoids: a queue whose only member cannot approve.
    expect(accountCreationDecision({ actorRole: null, accountCount: 0 })).toEqual({
      status: "approved",
      role: "admin",
      because: "bootstrap",
    });
  });

  it("turns a member's create into a request", () => {
    expect(accountCreationDecision({ actorRole: "member", accountCount: 3 })).toEqual({
      status: "pending",
      role: "member",
      because: "request",
    });
  });

  it("still turns a request into a request when the database is not empty but nobody is signed in", () => {
    expect(accountCreationDecision({ actorRole: null, accountCount: 1 })).toMatchObject({
      status: "pending",
    });
  });
});

describe("guardRequestAccount", () => {
  it("lets a request join an empty queue", () => {
    expect(guardRequestAccount({ pendingCount: 0 }).ok).toBe(true);
  });

  it("lets the last slot be taken", () => {
    expect(guardRequestAccount({ pendingCount: MAX_PENDING_REQUESTS - 1 }).ok).toBe(true);
  });

  it("refuses a full queue, and says how to drain it", () => {
    // The request endpoint is reachable without a session, so the queue has to
    // be finite. The refusal has to name the remedy: an admin refusing requests
    // is what empties it.
    const guard = guardRequestAccount({ pendingCount: MAX_PENDING_REQUESTS });
    expect(guard).toMatchObject({ ok: false, status: 429 });
    expect(refusal(guard)).toContain("admin");
    expect(refusal(guard)).toContain(String(MAX_PENDING_REQUESTS));
  });
});

describe("guardReviewRequest", () => {
  it("lets an admin approve something still pending", () => {
    expect(guardReviewRequest({ role: "admin", alreadyApproved: false }).ok).toBe(true);
  });

  it("refuses a member, which is the whole point of a queue", () => {
    const guard = guardReviewRequest({ role: "member", alreadyApproved: false });
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toContain("Only an admin");
  });

  it("refuses to re-stamp something already approved", () => {
    const guard = guardReviewRequest({ role: "admin", alreadyApproved: true });
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("already");
  });

  it("checks the role before the state, so a member learns nothing about a row", () => {
    expect(guardReviewRequest({ role: "member", alreadyApproved: true })).toMatchObject({
      status: 403,
    });
  });
});

describe("guardDeleteAccount", () => {
  const one = { actorId: 7, targetId: 8, accountCount: 2, removingAdmin: false, adminCount: 1 };

  it("refuses deleting the account you are signed in as", () => {
    const guard = guardDeleteAccount({ ...one, targetId: 7, accountCount: 3 });
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("signed in as");
  });

  it("refuses deleting the last account, which would reopen the bootstrap", () => {
    const guard = guardDeleteAccount({ ...one, targetId: 4, accountCount: 1, actorId: null });
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("only account");
  });

  it("refuses deleting the last admin, which would fill the queue forever", () => {
    const guard = guardDeleteAccount({ ...one, removingAdmin: true, adminCount: 1 });
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("only admin");
  });

  it("allows removing an admin while another admin remains", () => {
    expect(
      guardDeleteAccount({ ...one, removingAdmin: true, adminCount: 2 }).ok
    ).toBe(true);
  });

  it("allows removing somebody else when other accounts remain", () => {
    expect(guardDeleteAccount(one).ok).toBe(true);
  });

  it("does not need an admin count to remove a member", () => {
    // The two rules are separate: a member going never threatens the queue.
    expect(guardDeleteAccount({ ...one, adminCount: 0 }).ok).toBe(true);
  });
});

describe("guardSetPassword", () => {
  const base = { isSelf: false, isAdmin: false, currentSupplied: false, currentMatches: false };

  it("requires the current password on your own account", () => {
    expect(guardSetPassword({ ...base, isSelf: true })).toMatchObject({ ok: false, status: 400 });
    expect(guardSetPassword({ ...base, isSelf: true, currentSupplied: true })).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(
      guardSetPassword({ ...base, isSelf: true, currentSupplied: true, currentMatches: true }).ok
    ).toBe(true);
  });

  it("does not require one to reset somebody else's — that is the recovery path", () => {
    expect(guardSetPassword({ ...base, isAdmin: true }).ok).toBe(true);
  });

  it("refuses a member resetting someone else's, which would bypass the queue", () => {
    // The hole this closes: take over the admin's account, then approve yourself.
    const guard = guardSetPassword({ ...base, isAdmin: false });
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toContain("Only an admin");
  });

  it("never asks an admin for a current password on their own account's behalf", () => {
    // Self still wins: an admin changing their OWN password must prove it.
    expect(
      guardSetPassword({ ...base, isSelf: true, isAdmin: true, currentSupplied: false })
    ).toMatchObject({ ok: false, status: 400 });
  });
});

describe("parseNewAccount", () => {
  it("normalises a usable account", () => {
    expect(parseNewAccount({ username: "  Keng ", password: "correct horse" })).toEqual({
      ok: true,
      value: { username: "keng", password: "correct horse" },
    });
  });

  it("rejects the usernames normalizeUsername rejects, with the rule the form shows", () => {
    for (const username of ["k", "keng zs", "-keng", "keng.zhiming", "x".repeat(33), ""]) {
      const parsed = parseNewAccount({ username, password: "correct horse" });
      expect(parsed.ok, `expected "${username}" to be refused`).toBe(false);
      if (!parsed.ok) expect(parsed.error).toContain(USERNAME_RULE);
    }
  });

  it("rejects passwords the CLI would have rejected, and only those", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    const ok = "a".repeat(MIN_PASSWORD_LENGTH);

    expect(parseNewAccount({ username: "keng", password: short })).toMatchObject({ ok: false });
    expect(parseNewAccount({ username: "keng", password: ok })).toMatchObject({ ok: true });
    expect(parseNewAccount({ username: "keng", password: "x".repeat(201) })).toMatchObject({
      ok: false,
    });
  });

  it("agrees with validatePassword, so the form and the CLI cannot drift", () => {
    const candidates = [
      "",
      "short",
      "a".repeat(MIN_PASSWORD_LENGTH),
      "a".repeat(MIN_PASSWORD_LENGTH - 1),
      "x".repeat(200),
      "x".repeat(201),
      "pass word with spaces",
    ];

    for (const password of candidates) {
      expect(parseNewAccount({ username: "keng", password }).ok).toBe(
        validatePassword(password) === null
      );
    }
  });

  it("survives a body that is not an object", () => {
    for (const body of [undefined, null, "keng", 42, []]) {
      expect(parseNewAccount(body)).toMatchObject({ ok: false });
    }
    expect(parseNewAccount({ username: 42, password: null })).toMatchObject({ ok: false });
  });
});
