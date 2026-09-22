import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  expectedAuthToken,
  issueSessionToken,
  normalizeUsername,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { markSeen } from "@/lib/session";

export const dynamic = "force-dynamic";

// --- Rate limiting ---
// In-memory per-IP attempt tracker: after MAX_ATTEMPTS failed logins within
// WINDOW_MS, the IP is locked out for LOCKOUT_MS. Good enough for a private
// portfolio app — it just needs to make brute-force impractical, not survive a
// server restart. Different Next.js dev / prod instances each keep their own
// map, which is fine for this.
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

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}

/**
 * Sign in.
 *
 * One route, two kinds of session, decided by whether a username was sent:
 *
 *   { username, password }  an account. Resolves to a person, so anything that
 *                           needs to know WHO is looking can work — the
 *                           dashboard's "since you last looked" is the first
 *                           consumer.
 *   { password }            the original shared gate, kept working so adding
 *                           accounts can never lock the owner out.
 *
 * Both paths share the rate limiter, and both record failures against the IP
 * rather than the username: username-based lockout would let anyone freeze a
 * real person's account by guessing at it.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(rate.retryAfterSec / 60)} min` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const rawUsername = typeof body?.username === "string" ? body.username.trim() : "";

  // --- Account path ---
  if (rawUsername !== "") {
    const username = normalizeUsername(rawUsername);
    // A malformed username is answered exactly like a wrong password: telling
    // the caller which part was wrong narrows their search for free.
    if (!username) {
      recordFailure(ip);
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailure(ip);
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }

    // A request that no admin has approved yet is a real row with a real
    // password — that is what makes it approvable without a second handover —
    // but it is not yet an account. Said in plain words rather than the generic
    // "incorrect password", because the person is not guessing: they are
    // waiting, and the difference is the whole feature.
    if (!user.approvedAt) {
      return NextResponse.json(
        { error: "That account is waiting to be approved by an admin." },
        { status: 403 }
      );
    }

    const token = await issueSessionToken(username);
    if (!token) {
      return NextResponse.json(
        { error: "No AUTH_SECRET or SITE_PASSWORD is configured, so sessions can't be signed" },
        { status: 500 }
      );
    }

    attempts.delete(ip);
    // Seed the baseline: the first thing this person sees after signing in is
    // what changed since they were last here, not since some previous session.
    await markSeen(user.id);
    return setSessionCookie(NextResponse.json({ ok: true, username }), token);
  }

  // --- Shared-password gate ---
  const configuredPassword = process.env.SITE_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json(
      { error: "SITE_PASSWORD isn't configured on the server" },
      { status: 500 }
    );
  }
  if (!timingSafeEqualStr(password, configuredPassword)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  attempts.delete(ip);

  const token = await expectedAuthToken();
  return setSessionCookie(NextResponse.json({ ok: true }), token!);
}
