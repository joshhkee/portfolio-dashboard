// Throttling for the two endpoints anyone can reach without a session.
//
// This was the login route's private implementation until the login page grew
// a second job — asking for an account — because that request writes a row an
// admin has to look at, and an unthrottled endpoint that creates rows is an
// endpoint that lets anyone fill the review queue. Sharing it is the point: two
// copies of a sliding window would drift, and the copy nobody touched would be
// the one guarding the newer hole.
//
// In-memory and per-process on purpose. It only has to make guessing a password
// or spamming the queue impractical, not survive a deploy or coordinate across
// instances — this is a private portfolio dashboard, usually one process, and a
// Redis dependency would be more moving parts than the thing it protects.
//
// Semantics, kept exactly as the login route had them:
//
//   * a failure inside a live window increments the count;
//   * reaching `maxAttempts` locks the key for `lockoutMs`;
//   * a window that has gone quiet is dropped, so an occasional typo years
//     apart never accumulates into a lockout;
//   * `allowed` is consulted BEFORE the attempt, so the Nth failure locks
//     rather than being refused — the attempt that trips the limit still gets
//     its normal answer.

/** What a caller needs to know before it does the expensive thing. */
export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the key is usable again. 0 when the call is allowed. */
  retryAfterSec: number;
}

export interface RateLimiter {
  /** May this key try again right now? */
  check(key: string): RateLimitVerdict;
  /** Record a failed attempt against a key. */
  recordFailure(key: string): void;
  /** Forget a key — what a SUCCESSFUL attempt does, so a person who mistyped
   *  twice and then got in is not three failures away from a lockout. */
  reset(key: string): void;
  /** Drop windows that have gone quiet. Called on a timer; exposed so a test
   *  can assert it without waiting minutes. */
  sweep(): void;
  /** How many keys are being tracked. For tests and diagnostics. */
  size(): number;
}

export interface RateLimitOptions {
  /** Failures allowed inside one window before the key locks. */
  maxAttempts: number;
  /** How long a run of failures is remembered as one run. */
  windowMs: number;
  /** How long a key is refused once it trips. */
  lockoutMs: number;
  /** Injectable clock, so tests do not sleep. */
  now?: () => number;
}

interface Attempt {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

export function createRateLimiter({
  maxAttempts,
  windowMs,
  lockoutMs,
  now = Date.now,
}: RateLimitOptions): RateLimiter {
  const attempts = new Map<string, Attempt>();

  function check(key: string): RateLimitVerdict {
    const entry = attempts.get(key);
    if (!entry) return { allowed: true, retryAfterSec: 0 };

    const at = now();
    if (entry.lockedUntil > at) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - at) / 1000) };
    }

    // A window that has gone quiet starts over rather than carrying stale
    // failures forward into the next one.
    if (at - entry.firstAt > windowMs) {
      attempts.delete(key);
      return { allowed: true, retryAfterSec: 0 };
    }

    return { allowed: true, retryAfterSec: 0 };
  }

  function recordFailure(key: string) {
    const at = now();
    const entry = attempts.get(key);
    if (!entry || at - entry.firstAt > windowMs) {
      attempts.set(key, { count: 1, firstAt: at, lockedUntil: 0 });
      return;
    }
    entry.count += 1;
    if (entry.count >= maxAttempts) entry.lockedUntil = at + lockoutMs;
  }

  function sweep() {
    const at = now();
    for (const [key, entry] of attempts) {
      if (entry.lockedUntil < at && at - entry.firstAt > windowMs) attempts.delete(key);
    }
  }

  // Periodic cleanup so the map cannot grow one key per address forever.
  // `unref` keeps this from holding a process (or a test run) open.
  const timer = setInterval(sweep, 60_000);
  timer.unref?.();

  return {
    check,
    recordFailure,
    reset: (key: string) => void attempts.delete(key),
    sweep,
    size: () => attempts.size,
  };
}

/**
 * The address an attempt is charged to.
 *
 * Behind Vercel (and any proxy) the transport address is the proxy, so the
 * forwarded headers are read first. `unknown` is a real bucket rather than a
 * reason to skip limiting: if the headers are missing, every such request
 * shares one budget, which is the safe direction.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
