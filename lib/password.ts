// Password hashing for accounts.
//
// Deliberately NOT in lib/auth.ts: `middleware.ts` imports that file, middleware
// runs on the Edge runtime, and `node:crypto` does not exist there. This module
// is imported only by Node-side code (the login route, the create-user script),
// so it can use a real password hash instead of a digest.
//
// scrypt rather than bcrypt/argon2: it is in Node's standard library, which
// means no native dependency to compile on the deploy target for a portfolio
// dashboard. Parameters are stored IN the hash string, so the cost can be
// raised later without invalidating existing passwords — an old hash keeps
// verifying with its own parameters.
//
// Format: scrypt:N:r:p:<salt base64>:<hash base64>

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** ~16 MB of memory per hash and a linear cost per guess. */
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/** Eight characters. Short enough to type on a phone, long enough that the
 * login route's 5-attempts-per-5-minutes limiter is not the only thing standing
 * between a guesser and an account. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The password rule, in one place.
 *
 * Both writers call this — the create-user script and the accounts API — so the
 * rule cannot drift between the two ways an account gets made, which is exactly
 * how a UI ends up accepting something the CLI would have refused (or worse,
 * the other way round).
 *
 * Returns an error message, or null when the password is acceptable.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return "That password is too long.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join(":");
}

/**
 * True when `password` produced `stored`.
 *
 * An unparseable or unknown-scheme hash returns false rather than throwing: a
 * corrupt row must not turn into a 500 that tells the caller the password was
 * merely wrong in a different way.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  // Lengths are equal by construction (the key length is taken from the stored
  // hash), and timingSafeEqual still needs them to match to be called at all.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
