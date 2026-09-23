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
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// --- Rate limiting ---
// After 5 failed logins within 5 minutes, the address is locked out for 15
// minutes. The sliding window itself lives in lib/rate-limit.ts, because the
// account-request endpoint needs the same protection and two copies of it
// would drift. Failures are charged to the ADDRESS rather than the username:
// username-based lockout would let anyone freeze a real person's account by
// guessing at it.
const loginLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

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
  const rate = loginLimiter.check(ip);
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
      loginLimiter.recordFailure(ip);
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      loginLimiter.recordFailure(ip);
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

    loginLimiter.reset(ip);
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
    loginLimiter.recordFailure(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  loginLimiter.reset(ip);

  const token = await expectedAuthToken();
  return setSessionCookie(NextResponse.json({ ok: true }), token!);
}
