import Link from "next/link";
import { accountAdminContext, listAccounts } from "@/lib/account-admin";
import { USERNAME_RULE } from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { formatShortDate } from "@/lib/dates";
import AccountManager from "@/components/AccountManager";

export const dynamic = "force-dynamic";

/**
 * Accounts: who can sign in, who is waiting to, and whose "since you last
 * looked" is which.
 *
 * Chrome rather than an object, which is why it is not a sixth item in the nav —
 * it is linked from the bar's right-hand cluster, where the account you are
 * signed in as already lives.
 *
 * The page is three states, and it says which one it is rather than pretending
 * they are the same:
 *
 *   refused        signed in with the shared password while accounts exist. The
 *                  shared password carries no identity, so there is nobody to
 *                  attribute "add an account" to; the page explains the way in
 *                  instead of showing controls that would 403.
 *   bootstrap      no accounts exist yet. Anyone already past the gate may
 *                  create the first one — otherwise this page would be
 *                  unreachable without a shell.
 *   signed in      the list and the queue. What you may DO inside them is not
 *                  decided here: `meIsAdmin` is passed down, and the controls
 *                  the rules would refuse are not offered. A member sees the
 *                  list, can change their own password, and can ask for an
 *                  account for someone else; only an admin approves, resets or
 *                  removes.
 */
export default async function AccountsPage() {
  const { me, view, manage } = await accountAdminContext();

  if (!view.ok) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-ink-300">Accounts</p>
          <p className="mt-1 text-2xl font-medium">Not available from here</p>
        </div>
        <div className="panel flex flex-col gap-2 p-6">
          <p className="text-ink-100">{view.error}</p>
          <p className="text-sm text-ink-300">
            Sign in with a username and password to add or change accounts.{" "}
            <Link href="/login" className="text-accent hover:underline">
              Go to sign-in
            </Link>
            .
          </p>
          <p className="text-sm text-ink-500">
            The dashboard is still completely usable through the shared password — accounts only
            change what it can remember about who is looking, so nothing is gated behind this.
          </p>
        </div>
      </div>
    );
  }

  // Two lists rather than one with a flag, because they are two different jobs:
  // people who can sign in, and people waiting to. `listAccounts` returns both
  // ordered by name, so the split happens here where the copy explains it.
  const accounts = await listAccounts();
  const toRow = (account: (typeof accounts)[number]) => ({
    id: account.id,
    username: account.username,
    role: account.role,
    createdLabel: formatShortDate(account.createdAt),
    lastSeenLabel: account.lastSeenAt ? formatShortDate(account.lastSeenAt) : null,
  });
  const rows = accounts.filter((a) => a.approvedAt !== null).map(toRow);
  const requests = accounts.filter((a) => a.approvedAt === null).map(toRow);

  const meIsAdmin = manage.ok;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-ink-300">Accounts</p>
        <p className="mt-1 text-2xl font-medium">
          {rows.length} {rows.length === 1 ? "identity" : "identities"}
          {meIsAdmin && requests.length > 0 && (
            <span className="ml-2 text-base text-accent">
              · {requests.length} {requests.length === 1 ? "request" : "requests"} waiting
            </span>
          )}
        </p>
      </div>

      <AccountManager
        rows={rows}
        requests={requests}
        meId={me?.id ?? null}
        meIsAdmin={meIsAdmin}
        bootstrapping={me === null && rows.length === 0}
        minPasswordLength={MIN_PASSWORD_LENGTH}
        usernameRule={USERNAME_RULE}
      />
    </div>
  );
}
