"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Incorrect password");
      }
      // Only ever bounce to a same-origin path, never to ``//host``.
      const requested = searchParams.get("redirect") || "/";
      const redirect = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      // A hard navigation (rather than router.push) guarantees the freshly
      // set auth cookie rides along with the next document request and skips
      // any client-router cache of the pre-login redirect.
      window.location.assign(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex w-full max-w-sm flex-col gap-6 p-8">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <p className="font-serif text-base tracking-tight text-fg">Investments</p>
        </div>
        <h1 className="mt-5 text-xl font-medium tracking-tight text-fg">Enter password</h1>
        <p className="mt-2 text-sm text-fg-muted">Private ledger — sign in to continue.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          className="field"
          placeholder="••••••••"
        />
      </div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Checking…" : "Enter"}
      </button>

      {error && <p className="text-sm text-negative">{error}</p>}
    </form>
  );
}
