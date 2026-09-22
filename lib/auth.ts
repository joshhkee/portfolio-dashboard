// Session tokens for the dashboard.
//
// Two kinds of session share one cookie, and both have to keep working:
//
//   gate    — the original single shared SITE_PASSWORD. It answers "may this
//             person in" and carries no identity, because it has none: every
//             visitor is the same visitor. Left working on purpose, so adding
//             accounts can never lock the owner out of their own dashboard.
//   account — a username and password. It carries WHO is signed in, which is
//             what per-person state needs (the dashboard's "since you last
//             looked" line is the first user of it).
//
// Everything here is edge-safe: `middleware.ts` imports this file, and
// middleware runs on the Edge runtime where `node:crypto` does not exist. So
// tokens are built from WebCrypto's SHA-256, and password hashing — which needs
// scrypt and a per-user salt — lives in lib/password.ts instead.

export const AUTH_COOKIE_NAME = "dashboard_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent, early-return-free comparison for two short strings. */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** The cookie value the shared-password login sets: a hash of the configured
 * password, never the password itself, so the cookie is not a secret and every
 * session is invalidated when the password changes.
 *
 * Returns null when SITE_PASSWORD is unset — callers read that as "no gate
 * configured" rather than "always locked out", so a missing env var cannot
 * brick the site. */
export async function expectedAuthToken(): Promise<string | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  return sha256Hex(password);
}

/**
 * The secret account session tokens are signed with.
 *
 * AUTH_SECRET is preferred, so the shared password can be rotated or removed
 * without signing every account out. SITE_PASSWORD is the fallback because a
 * deployment with exactly one secret is the common case here. Null means no
 * secret is configured at all, which is the same "protection isn't set up"
 * state expectedAuthToken() reports.
 */
export function authSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.SITE_PASSWORD || null;
}

/**
 * Canonical form of a username, or null when it is unusable.
 *
 * Lowercased and trimmed so "Keng" and " keng " are the same account rather
 * than two — a login that silently creates a second identity for one person is
 * the failure mode worth designing out. The character set excludes "." because
 * the session token is dot-separated on the wire.
 */
export function normalizeUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (name.length < 2 || name.length > 32) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) return null;
  return name;
}

/** `username.issuedAt.signature` — the signature covers both other parts. */
async function signSession(
  username: string,
  issuedAt: number,
  secret: string
): Promise<string> {
  const signature = await sha256Hex(`${username}.${issuedAt}.${secret}`);
  return `${username}.${issuedAt}.${signature}`;
}

/** The cookie value a successful account login sets. */
export async function issueSessionToken(
  username: string,
  now: number = Date.now()
): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  return signSession(username, now, secret);
}

export interface SessionIdentity {
  username: string;
  /** When the session was issued, ms since epoch. */
  issuedAt: number;
}

/**
 * The account a token identifies, or null for anything that is not a valid,
 * unexpired, correctly-signed token.
 *
 * `issuedAt` is part of the signed payload rather than a separate cookie so the
 * age check cannot be bypassed by editing a value the signature does not cover.
 * A small allowance is made for clock skew in the future direction; the cookie's
 * own maxAge is the other half of the expiry, and this side is what makes a
 * token stop working even if the cookie is replayed.
 */
export async function readSessionToken(
  token: string | undefined | null,
  now: number = Date.now()
): Promise<SessionIdentity | null> {
  if (!token) return null;
  const secret = authSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, issuedAtRaw] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null;

  const ageMs = now - issuedAt;
  if (ageMs > AUTH_COOKIE_MAX_AGE * 1000) return null;
  if (ageMs < -5 * 60 * 1000) return null; // issued in the future: not ours

  if (normalizeUsername(username) !== username) return null;

  const expected = await signSession(username, issuedAt, secret);
  return constantTimeEqual(token, expected) ? { username, issuedAt } : null;
}
