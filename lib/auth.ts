export const AUTH_COOKIE_NAME = "dashboard_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Secrets pasted through an env/dashboard UI routinely arrive wrapped in a
 * pair of quotes or with a trailing newline or space (or a CRLF leftover).
 * Both the configured value and what someone types are cleaned the same way,
 * so a cosmetically mangled value can't lock the site out. */
export function normalizePassword(value: string): string {
  let v = value.trim();
  const first = v[0];
  if ((first === '"' || first === "'" || first === "`") && v.length > 1 && v.endsWith(first)) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Every env var that could be holding the site password. `SITE_PASSWORD` is
 * the canonical name, but keys typed into a dashboard are easy to store with
 * different casing — accept those too rather than failing a login that is
 * otherwise correct. */
function readCandidatePasswords(): string[] {
  const candidates = [process.env.SITE_PASSWORD, process.env.site_password];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizePassword(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

let warnedAboutNormalization = false;

/** The values a login is checked against. Empty means protection isn't
 * configured — callers treat that as "no protection" rather than "always
 * locked out", so a missing env var can't accidentally brick the site. */
export function configuredPasswords(): string[] {
  const passwords = readCandidatePasswords();
  if (!warnedAboutNormalization && passwords.length > 0) {
    warnedAboutNormalization = true;
    const raw = [process.env.SITE_PASSWORD, process.env.site_password];
    if (raw.some((value) => value !== undefined && normalizePassword(value) !== value)) {
      console.warn(
        "[auth] SITE_PASSWORD had surrounding whitespace or quotes; the cleaned value is being used."
      );
    }
  }
  return passwords;
}

/** Compares in a way that doesn't leak length via an early return. */
export function passwordMatches(input: string, candidates = configuredPasswords()): boolean {
  if (candidates.length === 0) return false;
  const attempted = new TextEncoder().encode(normalizePassword(input));
  return candidates.some((candidate) => {
    const expected = new TextEncoder().encode(candidate);
    let diff = attempted.length ^ expected.length;
    for (let i = 0; i < Math.max(attempted.length, expected.length); i++) {
      diff |= (attempted[i] ?? 0) ^ (expected[i] ?? 0);
    }
    return diff === 0;
  });
}

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
  const [password] = configuredPasswords();
  if (!password) return null;
  return sha256Hex(password);
}
