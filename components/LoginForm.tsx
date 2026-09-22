"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Sign in, with or without an account.
 *
 * Both fields are on the form because the server decides which kind of session
 * to create from whether a username was sent (see app/api/login/route.ts). The
 * hint says so plainly: someone who only ever knew the shared password should
 * not have to work out that leaving a field blank is the way to use it.
 */
export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
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
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Incorrect password");
      }
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex w-full max-w-sm flex-col gap-4 p-6">
      <div>
        <p className="text-sm text-ink-300">Investments</p>
        <p className="text-lg font-medium text-ink-100">Sign in to continue</p>
      </div>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
        autoComplete="username"
        className="field"
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        className="field"
        placeholder="Password"
      />
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Checking…" : "Enter"}
      </button>
      {error && <p className="text-sm text-loss">{error}</p>}
      <p className="text-xs text-ink-500">
        Leave the username blank to sign in with the shared password. An account is what lets the
        dashboard remember when you last looked.
      </p>
    </form>
  );
}
