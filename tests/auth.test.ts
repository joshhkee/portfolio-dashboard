import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AUTH_COOKIE_MAX_AGE,
  issueSessionToken,
  normalizeUsername,
  readSessionToken,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("normalizeUsername", () => {
  it("lowercases and trims, so one person cannot hold two accounts", () => {
    expect(normalizeUsername("Keng")).toBe("keng");
    expect(normalizeUsername("  JOSH  ")).toBe("josh");
    expect(normalizeUsername("Zhi-Ming")).toBe("zhi-ming");
    expect(normalizeUsername("keng_2")).toBe("keng_2");
  });

  it("rejects a dot, because the session token is dot-separated", () => {
    expect(normalizeUsername("keng.zhiming")).toBeNull();
  });

  it("rejects names that are too short, too long or not name-shaped", () => {
    expect(normalizeUsername("k")).toBeNull();
    expect(normalizeUsername("x".repeat(33))).toBeNull();
    expect(normalizeUsername("keng zs")).toBeNull();
    expect(normalizeUsername("-keng")).toBeNull();
    expect(normalizeUsername("keng@example.com")).toBeNull();
    expect(normalizeUsername("")).toBeNull();
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies the password it hashed and nothing else", () => {
    const stored = hashPassword("correct horse battery staple");

    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
    expect(verifyPassword("CORRECT HORSE BATTERY STAPLE", stored)).toBe(false);
  });

  it("never stores the password, and salts so two equal passwords differ", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");

    expect(a).not.toContain("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
    expect(a.startsWith("scrypt:")).toBe(true);
  });

  it("returns false rather than throwing on a corrupt hash", () => {
    expect(verifyPassword("anything", "")).toBe(false);
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(verifyPassword("anything", "scrypt:1:2:3:4")).toBe(false);
    expect(verifyPassword("anything", "bcrypt:16384:8:1:c2FsdA==:aGFzaA==")).toBe(false);
    expect(verifyPassword("anything", "scrypt:16384:8:1:!!!:!!!")).toBe(false);
  });
});

describe("session tokens", () => {
  const originalSecret = process.env.AUTH_SECRET;
  const originalPassword = process.env.SITE_PASSWORD;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
    delete process.env.SITE_PASSWORD;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = originalPassword;
  });

  it("round-trips the username it was issued for", async () => {
    const now = 1_700_000_000_000;
    const token = await issueSessionToken("keng", now);

    expect(await readSessionToken(token, now)).toEqual({ username: "keng", issuedAt: now });
  });

  it("falls back to SITE_PASSWORD as the signing secret when there is no AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    process.env.SITE_PASSWORD = "shared-password";

    const token = await issueSessionToken("roy", 1_700_000_000_000);
    expect(await readSessionToken(token, 1_700_000_000_000)).not.toBeNull();
  });

  it("issues nothing when no secret is configured at all", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.SITE_PASSWORD;

    expect(await issueSessionToken("keng")).toBeNull();
    expect(await readSessionToken("keng.1700000000000.deadbeef")).toBeNull();
  });

  it("rejects a token whose signature does not cover its contents", async () => {
    const now = 1_700_000_000_000;
    const token = (await issueSessionToken("keng", now))!;
    const [, issuedAt, signature] = token.split(".");

    // Same signature, different username: the classic forgery attempt.
    expect(await readSessionToken(`roy.${issuedAt}.${signature}`, now)).toBeNull();
    // Same username, moved clock.
    expect(await readSessionToken(`keng.${Number(issuedAt) + 60_000}.${signature}`, now)).toBeNull();
    // Truncated / padded signature.
    expect(await readSessionToken(`keng.${issuedAt}.${signature.slice(0, -1)}`, now)).toBeNull();
    expect(await readSessionToken(`${token}x`, now)).toBeNull();
  });

  it("rejects a token from another deployment's secret", async () => {
    const now = 1_700_000_000_000;
    const token = (await issueSessionToken("keng", now))!;
    process.env.AUTH_SECRET = "a-different-secret";

    expect(await readSessionToken(token, now)).toBeNull();
  });

  it("expires on its own age, not only on the cookie's maxAge", async () => {
    const now = 1_700_000_000_000;
    const token = (await issueSessionToken("keng", now))!;

    expect(await readSessionToken(token, now + AUTH_COOKIE_MAX_AGE * 1000)).not.toBeNull();
    expect(await readSessionToken(token, now + AUTH_COOKIE_MAX_AGE * 1000 + 1)).toBeNull();
  });

  it("rejects nonsense, including a token issued far in the future", async () => {
    const now = 1_700_000_000_000;
    const future = (await issueSessionToken("keng", now + 60 * 60 * 1000))!;

    expect(await readSessionToken(undefined, now)).toBeNull();
    expect(await readSessionToken("", now)).toBeNull();
    expect(await readSessionToken("keng", now)).toBeNull();
    expect(await readSessionToken("keng.notanumber.sig", now)).toBeNull();
    expect(await readSessionToken("keng.-5.sig", now)).toBeNull();
    expect(await readSessionToken(future, now)).toBeNull();
  });
});
