"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, KeyRound, Plus, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";

/** One row of the manager. Dates arrive as strings because the server formats
 * them: formatting on the client would be a second, differently-locale'd copy of
 * the app's one date format (lib/dates.ts), and would disagree with the server
 * HTML on hydration. */
export interface AccountRow {
  id: number;
  username: string;
  /** "admin" or "member" — the raw stored string, narrowed for display only. */
  role: string;
  /** When the account was created, e.g. "22 Sep 26". */
  createdLabel: string;
  /** When it was last signed in with, or null if never. */
  lastSeenLabel: string | null;
}

/**
 * Add, request, approve, reset and remove accounts.
 *
 * The rules are NOT re-implemented here. Username shape and password length are
 * checked by the API (lib/accounts.ts), and this component's only client-side
 * check is that the two password fields match — the one thing the server cannot
 * see. So a rule has exactly one home, and the numbers it depends on are passed
 * in from the server rather than written down twice.
 *
 * What the component DOES decide is which controls to offer, and it errs by not
 * offering: an action the server would refuse is hidden rather than shown and
 * then rejected. That is why `meIsAdmin` is threaded through rather than each
 * button discovering its own 403 — `Reset password` and `Remove` do not appear
 * for a member, and the request queue is not their to-do list.
 *
 * Nothing here can lock you out, which is why the buttons read the way they do:
 * you cannot remove the account you are signed in as, the last account cannot be
 * removed at all, and neither can the last admin (all refused server-side,
 * explained inline).
 */
export default function AccountManager({
  rows,
  requests,
  meId,
  meIsAdmin,
  bootstrapping,
  minPasswordLength,
  usernameRule,
}: {
  rows: AccountRow[];
  /** Requests an admin has not decided yet. Empty for a member, who cannot act
   *  on them — the count is still shown so they know one is waiting. */
  requests: AccountRow[];
  /** The account signed in right now, or null in the bootstrap state. */
  meId: number | null;
  /** Whether the caller may create outright, approve, reset and remove. */
  meIsAdmin: boolean;
  /** True when no account exists yet, so the first one is being created. */
  bootstrapping: boolean;
  minPasswordLength: number;
  usernameRule: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(bootstrapping);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  /** Which row's password form is open. */
  const [passwordFor, setPasswordFor] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function messageFor(id: number) {
    return rowError?.id === id ? rowError.message : null;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateNotice(null);

    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      setCreateError("The passwords don't match.");
      return;
    }

    setCreateBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Couldn't create the account");
      }
      setCreateOpen(false);
      // Which of the two happened is the server's answer, not a guess from
      // `meIsAdmin`: the bootstrap creates an admin, and that state has no
      // signed-in account at all.
      if (body.status === "pending") {
        setCreateNotice(
          `Request sent for "${body.user?.username ?? username}". An admin has to approve it before it can sign in.`
        );
      } else {
        setCreateNotice(`Account "${body.user?.username ?? username}" can sign in now.`);
      }
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>, row: AccountRow) {
    e.preventDefault();
    setRowError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    const currentPassword = String(form.get("currentPassword") ?? "");

    if (password !== confirm) {
      setRowError({ id: row.id, message: "The passwords don't match." });
      return;
    }

    setBusyId(row.id);
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, currentPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't change the password");
      }
      setPasswordFor(null);
      router.refresh();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: AccountRow) {
    if (
      !confirm(
        `Remove the account "${row.username}"? They can no longer sign in as themselves. Nothing they can see changes — every account sees the same dashboard.`
      )
    ) {
      return;
    }

    setRowError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/users/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't remove the account");
      }
      router.refresh();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(row: AccountRow) {
    setRowError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/users/${row.id}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't approve the request");
      }
      setCreateNotice(`Approved "${row.username}". They sign in with the password they chose.`);
      router.refresh();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefuse(row: AccountRow) {
    if (
      !confirm(
        `Refuse the account request from "${row.username}"? The request is deleted. Nobody is told — there is no email here, so say so yourself if you meant no.`
      )
    ) {
      return;
    }

    setRowError(null);
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/users/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't refuse the request");
      }
      router.refresh();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {bootstrapping && (
        <div className="panel flex items-start gap-3 p-4">
          <ShieldCheck size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <div className="flex flex-col gap-1">
            <p className="text-sm text-ink-100">No accounts yet</p>
            <p className="text-sm text-ink-300">
              The dashboard currently opens with the shared password, which doesn&apos;t say{" "}
              <em>who</em> is looking — so it can&apos;t tell anyone what changed while they were away.
              The first account you create is the <strong>admin</strong>: it can create and approve
              the rest.
            </p>
          </div>
        </div>
      )}

      {/* The queue, above the list, because it is the only thing on this page
          with a deadline: a request is somebody waiting to get in. Admin only —
          for anyone else it is a list of actions they cannot take. */}
      {meIsAdmin && requests.length > 0 && (
        /* `ring`, not `border-accent/40`: `.panel` is a component-layer rule and
           it already carries `border border-ink-700`, and the components layer
           beats utilities — so a border colour here is silently discarded.
           `.panel` sets no box-shadow, so the ring is the one that lands. */
        <div className="panel flex flex-col ring-1 ring-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 p-4">
            <div>
              <p className="flex items-center gap-2 text-ink-100">
                <Clock size={15} strokeWidth={2} className="text-accent" />
                {requests.length} {requests.length === 1 ? "request" : "requests"} waiting
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Each one already chose a password, so approving lets them in without passing a
                secret around.
              </p>
            </div>
          </div>
          <ul>
            {requests.map((row) => {
              const message = messageFor(row.id);
              return (
                <li key={row.id} className="border-b border-ink-700 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-ink-100">
                        <UserPlus size={14} strokeWidth={1.75} className="text-ink-300" />
                        {row.username}
                      </p>
                      <p className="text-xs text-ink-500">Requested {row.createdLabel}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-primary flex items-center gap-1.5 text-xs"
                        disabled={busyId === row.id}
                        onClick={() => handleApprove(row)}
                      >
                        <Check size={13} strokeWidth={2.5} />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-ghost flex items-center gap-1.5 text-xs"
                        disabled={busyId === row.id}
                        onClick={() => handleRefuse(row)}
                      >
                        <X size={13} strokeWidth={2.5} />
                        Refuse
                      </button>
                    </div>
                  </div>
                  {message && (
                    <p role="alert" className="px-4 pb-4 text-sm text-loss">
                      {message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* A member cannot act on the queue, but should not be left wondering
          whether their request was received. */}
      {!meIsAdmin && requests.length > 0 && (
        <p className="text-xs text-ink-500">
          {requests.length} account {requests.length === 1 ? "request is" : "requests are"} waiting
          for an admin to approve.
        </p>
      )}

      <div className="panel flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 p-4">
          {/* The count is the page's headline and deliberately not repeated
              here; this line says what the count cannot, which is what an
              account IS. */}
          <div className="max-w-xl">
            <p className="text-ink-100">Sign-in accounts</p>
            <p className="text-xs text-ink-500">
              Every account sees the same portfolio. An account is an identity — who is signed in,
              and when they last looked. Admins additionally create accounts and approve requests.
            </p>
          </div>
          {!createOpen && (
            <button
              type="button"
              className={meIsAdmin ? "btn-primary flex items-center gap-1.5" : "btn-ghost flex items-center gap-1.5"}
              onClick={() => {
                setCreateError(null);
                setCreateNotice(null);
                setCreateOpen(true);
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              {meIsAdmin ? "Add account" : "Request an account"}
            </button>
          )}
        </div>

        {createOpen && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 border-b border-ink-700 p-4"
          >
            {/* The width lives on the WRAPPER, not the control: `.field` is a
                component-layer rule carrying `w-full`, and `@layer components`
                beats the utilities layer whatever the class order — so a width
                on the input itself silently does nothing. */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-40 flex-col gap-1">
                <label className="text-xs text-ink-300" htmlFor="new-username">
                  Username
                </label>
                <input
                  id="new-username"
                  name="username"
                  required
                  autoFocus
                  autoComplete="off"
                  className="field"
                  placeholder="e.g. keng"
                  title={usernameRule}
                />
              </div>
              <div className="flex w-44 flex-col gap-1">
                <label className="text-xs text-ink-300" htmlFor="new-password">
                  Password
                </label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="field"
                  title={`At least ${minPasswordLength} characters.`}
                />
              </div>
              <div className="flex w-44 flex-col gap-1">
                <label className="text-xs text-ink-300" htmlFor="new-confirm">
                  Confirm
                </label>
                <input
                  id="new-confirm"
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="field"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={createBusy}>
                  {createBusy
                    ? meIsAdmin
                      ? "Creating…"
                      : "Sending…"
                    : meIsAdmin
                      ? "Create account"
                      : "Send request"}
                </button>
                {!bootstrapping && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={createBusy}
                    onClick={() => {
                      setCreateOpen(false);
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-ink-500">
              Usernames: {usernameRule}. Passwords: at least {minPasswordLength} characters. Stored
              is a salted scrypt hash — the password itself is never kept.
              {!meIsAdmin && " What you send is a request: it can't sign in until an admin approves it."}
            </p>
            {createError && (
              <p role="alert" className="text-sm text-loss">
                {createError}
              </p>
            )}
          </form>
        )}

        {createNotice && (
          <p role="status" className="border-b border-ink-700 px-4 py-3 text-sm text-gain">
            {createNotice}
          </p>
        )}

        {rows.length === 0 ? (
          // Only when the form is closed: while it is open the form IS the
          // empty state, and the line would just restate the banner above it.
          !createOpen && (
            <p className="p-4 text-sm text-ink-500">
              No accounts yet — add one and the dashboard starts remembering who has looked.
            </p>
          )
        ) : (
          <ul>
            {rows.map((row) => {
              const isMe = row.id === meId;
              const message = messageFor(row.id);
              return (
                <li key={row.id} className="border-b border-ink-700 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-ink-100">
                        {row.username}
                        {row.role === "admin" && (
                          <span className="flex items-center gap-1 rounded border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                            <ShieldCheck size={10} strokeWidth={2.5} />
                            Admin
                          </span>
                        )}
                        {isMe && (
                          <span className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-300">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-500">
                        Added {row.createdLabel} ·{" "}
                        {row.lastSeenLabel ? `last signed in ${row.lastSeenLabel}` : "never signed in"}
                      </p>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {(isMe || meIsAdmin) && (
                        <button
                          type="button"
                          className="btn-ghost flex items-center gap-1.5 text-xs"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setRowError(null);
                            setPasswordFor(passwordFor === row.id ? null : row.id);
                          }}
                        >
                          <KeyRound size={13} strokeWidth={1.75} />
                          {isMe ? "Change password" : "Reset password"}
                        </button>
                      )}
                      {meIsAdmin && (
                        <button
                          type="button"
                          className="btn-ghost flex items-center gap-1.5 text-xs text-loss"
                          disabled={busyId === row.id}
                          onClick={() => handleDelete(row)}
                          title={
                            isMe
                              ? "You're signed in as this account — sign in as another to remove it"
                              : "Remove this account"
                          }
                        >
                          <Trash2 size={13} strokeWidth={1.75} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {passwordFor === row.id && (
                    <form
                      onSubmit={(e) => handleSetPassword(e, row)}
                      className="flex flex-col gap-3 px-4 pb-4"
                    >
                      <div className="flex flex-wrap items-end gap-3">
                        {isMe && (
                          <div className="flex w-44 flex-col gap-1">
                            <label className="text-xs text-ink-300" htmlFor={`current-${row.id}`}>
                              Current password
                            </label>
                            <input
                              id={`current-${row.id}`}
                              name="currentPassword"
                              type="password"
                              required
                              autoFocus
                              autoComplete="current-password"
                              className="field"
                            />
                          </div>
                        )}
                        <div className="flex w-44 flex-col gap-1">
                          <label className="text-xs text-ink-300" htmlFor={`password-${row.id}`}>
                            New password
                          </label>
                          <input
                            id={`password-${row.id}`}
                            name="password"
                            type="password"
                            required
                            autoFocus={!isMe}
                            autoComplete="new-password"
                            className="field"
                            title={`At least ${minPasswordLength} characters.`}
                          />
                        </div>
                        <div className="flex w-44 flex-col gap-1">
                          <label className="text-xs text-ink-300" htmlFor={`confirm-${row.id}`}>
                            Confirm
                          </label>
                          <input
                            id={`confirm-${row.id}`}
                            name="confirm"
                            type="password"
                            required
                            autoComplete="new-password"
                            className="field"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={busyId === row.id}
                          >
                            {busyId === row.id ? "Saving…" : "Set password"}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setPasswordFor(null);
                              setRowError(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {!isMe && (
                        <p className="text-xs text-ink-500">
                          There&apos;s no email on file, so resetting someone&apos;s password here is
                          how they get back in. Tell them the new one out of band, and have them
                          change it.
                        </p>
                      )}
                    </form>
                  )}

                  {message && (
                    <p role="alert" className="px-4 pb-4 text-sm text-loss">
                      {message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
