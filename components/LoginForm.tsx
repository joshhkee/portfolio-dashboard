"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Getting in, in the three ways this app actually has.
 *
 * The form used to be ONE form whose behaviour changed depending on whether a
 * username was typed, explained in a footnote. That is a rule the server has,
 * not something a person should have to read about: someone waiting on an
 * approval and someone with a password are in different situations, and each
 * needs a different question asked of them. So the three are explicit modes,
 * and the mode is named in words at the top:
 *
 *   sign in          a username and its password. The account path.
 *   shared password  the original gate. One field, and a sentence saying what
 *                    it costs you (no name, so no "since you last looked").
 *   request          ask for an account you cannot sign in with yet. Reachable
 *                    before you are in, because that is the only moment it is
 *                    useful.
 *
 * The request mode is also the answer to a question the old page quietly got
 * wrong: a person who had the shared password but no account had nothing to do
 * except guess that leaving a field blank was the way through.
 *
 * Approval is not access control in this app — the shared password already
 * opens the whole dashboard — so this page says so rather than implying that a
 * pending person is shut out. What waits on the admin is the NAME, and the name
 * is what lets the dashboard remember when you last looked.
 */
type Mode = "signin" | "shared" | "request";

export default function LoginForm({
  usernameRule,
  minPasswordLength,
}: {
  usernameRule: string;
  minPasswordLength: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The username whose request was just accepted. Non-null switches the panel
   *  to the "what happens now" state, which is the only place the page can tell
   *  someone where their request went. */
  const [sent, setSent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirect = searchParams.get("redirect") || "/";

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setSent(null);
    setPassword("");
    setConfirm("");
  }

  /** The shared door: no username is sent, so the server creates a session with
   *  no identity behind it. */
  async function signIn(payload: { username?: string; password: string }) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Incorrect password");
    }
    router.push(redirect);
    router.refresh();
  }

  async function requestAccount() {
    if (password !== confirm) throw new Error("Those passwords don't match.");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Could not send the request.");

    if (body.status === "approved") {
      // The bootstrap: no accounts existed, so this one is live and is an admin.
      // There is nothing to wait for, so go straight in.
      await signIn({ username, password });
      return;
    }
    setSent(username.trim().toLowerCase());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "request") await requestAccount();
      else await signIn(mode === "signin" ? { username, password } : { password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="panel flex w-full max-w-sm flex-col gap-4 p-6">
        <div>
          <p className="text-sm text-ink-300">Investments</p>
          <p className="text-lg font-medium text-ink-100">Request sent</p>
        </div>
        <p className="text-sm text-ink-300">
          An admin has to approve <span className="num text-ink-100">{sent}</span> before you can
          sign in with it.
        </p>
        <p className="text-xs text-ink-500">
          Nothing is locked while you wait — the shared password opens the same dashboard. The
          account is what lets it remember when you last looked.
        </p>
        <button
          type="button"
          onClick={() => go("shared")}
          className="btn-primary"
        >
          Use the shared password
        </button>
        <div className="border-t border-ink-700 pt-3">
          <button
            type="button"
            onClick={() => go("signin")}
            className="text-xs text-ink-300 transition hover:text-ink-100 motion-reduce:transition-none"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel flex w-full max-w-sm flex-col gap-4 p-6">
      <div>
        <p className="text-sm text-ink-300">Investments</p>
        <p className="text-lg font-medium text-ink-100">
          {mode === "request" ? "Request an account" : "Sign in to continue"}
        </p>
      </div>

      {/* A username is what distinguishes signing in from the shared door, so
          the field is absent in shared mode rather than blank — the page is not
          asking a question it would ignore. */}
      {mode !== "shared" && (
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          className="field"
          placeholder="Username"
        />
      )}

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoFocus={mode === "shared"}
        autoComplete={mode === "request" ? "new-password" : "current-password"}
        className="field"
        placeholder={mode === "shared" ? "Shared password" : "Password"}
      />

      {mode === "request" && (
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="field"
          placeholder="Confirm password"
        />
      )}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Checking…" : mode === "request" ? "Send request" : "Enter"}
      </button>

      {error && <p className="text-sm text-loss">{error}</p>}

      {mode === "shared" && (
        <p className="text-xs text-ink-500">
          You&apos;ll be signed in without a name, so the dashboard can&apos;t remember when you
          last looked. Everything else works the same.
        </p>
      )}
      {mode === "request" && (
        <p className="text-xs text-ink-500">
          Usernames are {usernameRule}. Passwords are at least {minPasswordLength} characters.
        </p>
      )}

      {/* The ways in, named rather than implied. Shown as one line each so the
          page never has to explain that a blank field means something. */}
      <div className="flex flex-col gap-2 border-t border-ink-700 pt-3">
        {mode !== "signin" && (
          <button
            type="button"
            onClick={() => go("signin")}
            className="text-left text-xs text-ink-300 transition hover:text-ink-100 motion-reduce:transition-none"
          >
            Sign in with a username
          </button>
        )}
        {mode !== "request" && (
          <button
            type="button"
            onClick={() => go("request")}
            className="text-left text-xs text-accent transition hover:underline motion-reduce:transition-none"
          >
            No account yet? Request one
          </button>
        )}
        {mode !== "shared" && (
          <button
            type="button"
            onClick={() => go("shared")}
            className="text-left text-xs text-ink-300 transition hover:text-ink-100 motion-reduce:transition-none"
          >
            Use the shared password instead
          </button>
        )}
      </div>
    </form>
  );
}
