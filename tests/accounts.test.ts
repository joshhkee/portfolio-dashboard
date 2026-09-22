import { describe, it, expect } from "vitest";
import {
  guardDeleteAccount,
  guardManageAccounts,
  guardSetPassword,
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

describe("guardManageAccounts", () => {
  it("lets an account holder manage accounts", () => {
    expect(guardManageAccounts(true, 1).ok).toBe(true);
    expect(guardManageAccounts(true, 9).ok).toBe(true);
  });

  it("allows the bootstrap: no accounts at all, so the first one can be created", () => {
    // Without this the page would be unreachable until somebody ran the CLI.
    expect(guardManageAccounts(false, 0).ok).toBe(true);
  });

  it("refuses the shared password once any account exists", () => {
    const guard = guardManageAccounts(false, 1);
    expect(guard).toMatchObject({ ok: false, status: 403 });
    expect(refusal(guard)).toContain("username");
  });
});

describe("guardDeleteAccount", () => {
  it("refuses deleting the account you are signed in as", () => {
    const guard = guardDeleteAccount(7, 7, 3);
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("signed in as");
  });

  it("refuses deleting the last account, which would reopen the bootstrap", () => {
    const guard = guardDeleteAccount(null, 4, 1);
    expect(guard).toMatchObject({ ok: false, status: 400 });
    expect(refusal(guard)).toContain("only account");

    // ...and it stays refused even for the person holding it, for the same reason.
    expect(guardDeleteAccount(4, 4, 1).ok).toBe(false);
  });

  it("allows deleting somebody else when other accounts remain", () => {
    expect(guardDeleteAccount(7, 8, 2).ok).toBe(true);
    expect(guardDeleteAccount(null, 8, 2).ok).toBe(true);
  });
});

describe("guardSetPassword", () => {
  it("requires the current password on your own account", () => {
    expect(guardSetPassword({ isSelf: true, currentSupplied: false, currentMatches: false })).toMatchObject(
      { ok: false, status: 400 }
    );
    expect(
      guardSetPassword({ isSelf: true, currentSupplied: true, currentMatches: false })
    ).toMatchObject({ ok: false, status: 401 });
    expect(guardSetPassword({ isSelf: true, currentSupplied: true, currentMatches: true }).ok).toBe(
      true
    );
  });

  it("does not require one to reset somebody else's — that is the recovery path", () => {
    expect(
      guardSetPassword({ isSelf: false, currentSupplied: false, currentMatches: false }).ok
    ).toBe(true);
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
