import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, expectedAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// --- Rate limiting ---
// In-memory per-IP attempt tracker: after MAX_ATTEMPTS failed logins
// within WINDOW_MS, the IP is locked out for LOCKOUT_MS. Good enough
// for a single-user personal app — it just needs to make brute-force
// impractical, not survive a server restart. Different Next.js dev /
// prod instances each keep their own map, which is fine for this.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // sliding 5-minute window
const LOCKOUT_MS = 15 * 60 * 1000; // locked for 15 minutes after 5 failures

const attempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) return { allowed: true, retryAfterSec: 0 };

  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  // Reset the sliding window if the last failure was long ago.
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(ip);
    return { allowed: true, retryAfterSec: 0 };
  }

  return { allowed: true, retryAfterSec: 0 };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

/** Constant-time string comparison so login response timing doesn't
 * leak how much of the password matched. Falls back to == for
 * different-length strings (length still leaks; unavoidable without
 * HMAC, and acceptable here). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Periodically drop stale entries so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.firstAt > WINDOW_MS) attempts.delete(ip);
  }
}, 60_000).unref?.();

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(rate.retryAfterSec / 60)} min` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const { password } = await req.json();
  const configuredPassword = process.env.SITE_PASSWORD;

  if (!configuredPassword) {
    return NextResponse.json(
      { error: "SITE_PASSWORD isn't configured on the server" },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || !timingSafeEqualStr(password, configuredPassword)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  attempts.delete(ip); // successful login clears the failure history

  const token = await expectedAuthToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
