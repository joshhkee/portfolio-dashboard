import { describe, it, expect } from "vitest";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/** A limiter on a clock the test owns, so nothing sleeps. */
function limiter(overrides: Partial<{ maxAttempts: number; windowMs: number; lockoutMs: number }> = {}) {
  let at = 1_000_000;
  const instance = createRateLimiter({
    maxAttempts: 3,
    windowMs: 60_000,
    lockoutMs: 300_000,
    now: () => at,
    ...overrides,
  });
  return {
    instance,
    advance(ms: number) {
      at += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows a key it has never seen", () => {
    const { instance } = limiter();
    expect(instance.check("1.2.3.4")).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it("locks the key on the attempt that reaches the limit, not before", () => {
    const { instance } = limiter();
    // The Nth failure still gets its normal answer; the (N+1)th is refused.
    for (let i = 0; i < 3; i++) {
      expect(instance.check("ip").allowed, `attempt ${i + 1} should be allowed`).toBe(true);
      instance.recordFailure("ip");
    }
    const verdict = instance.check("ip");
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSec).toBe(300);
  });

  it("reports the remaining wait, rounded up to whole seconds", () => {
    const { instance, advance } = limiter();
    for (let i = 0; i < 3; i++) instance.recordFailure("ip");
    advance(299_000);
    expect(instance.check("ip").retryAfterSec).toBe(1);
    advance(1_000);
    expect(instance.check("ip").allowed).toBe(true);
  });

  it("forgets a run of failures once the window has gone quiet", () => {
    const { instance, advance } = limiter();
    instance.recordFailure("ip");
    instance.recordFailure("ip");
    advance(60_001);
    // Two failures long ago must not leave the key one attempt from a lockout.
    expect(instance.check("ip").allowed).toBe(true);
    for (let i = 0; i < 3; i++) instance.recordFailure("ip");
    expect(instance.check("ip").allowed).toBe(false);
  });

  it("clears a key after a success, so a typo is not held against anyone", () => {
    const { instance } = limiter();
    instance.recordFailure("ip");
    instance.recordFailure("ip");
    instance.reset("ip");
    expect(instance.size()).toBe(0);
    for (let i = 0; i < 3; i++) instance.recordFailure("ip");
    expect(instance.check("ip").allowed).toBe(false);
  });

  it("charges each key separately", () => {
    const { instance } = limiter();
    for (let i = 0; i < 3; i++) instance.recordFailure("a");
    expect(instance.check("a").allowed).toBe(false);
    expect(instance.check("b").allowed).toBe(true);
  });

  it("sweeps quiet keys away and keeps live ones", () => {
    const { instance, advance } = limiter();
    instance.recordFailure("stale");
    advance(60_001);
    instance.recordFailure("fresh");
    instance.sweep();
    expect(instance.size()).toBe(1);
    // The survivor is the one that was just used: a sweep must not clear a
    // window that is still counting.
    for (let i = 0; i < 2; i++) instance.recordFailure("fresh");
    expect(instance.check("fresh").allowed).toBe(false);
  });
});

describe("clientIp", () => {
  const withHeaders = (headers: Record<string, string>) => new Request("http://local/", { headers });

  it("reads the first address in the forwarded chain", () => {
    expect(clientIp(withHeaders({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip, then to one shared bucket", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    // A missing header is a bucket rather than an exemption: everyone without
    // one shares a budget, which is the safe direction.
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });
});
