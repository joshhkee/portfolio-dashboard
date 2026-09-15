export const AUTH_COOKIE_NAME = "dashboard_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a successful login sets, and what middleware checks
 * every request against — a hash of the configured password, not the
 * password itself, so the cookie never carries the plaintext secret and
 * every existing session is automatically invalidated if the password
 * is ever changed.
 *
 * Returns null if SITE_PASSWORD isn't configured — callers treat that
 * as "no protection configured" rather than "always locked out", so a
 * missing env var can't accidentally brick the site. */
export async function expectedAuthToken(): Promise<string | null> {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  return sha256Hex(password);
}
