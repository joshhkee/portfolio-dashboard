import Link from "next/link";
import { accountAdminContext, listAccounts } from "@/lib/account-admin";
import { USERNAME_RULE } from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { formatShortDate } from "@/lib/dates";
import AccountManager from "@/components/AccountManager";

export const dynamic = "force-dynamic";

/**
 * Accounts: who can sign in, and whose "since you last looked" is which.
 *
 * Chrome rather than an object, which is why it is not a sixth item in the nav —
 * it is linked from the bar's right-hand cluster, where the account you are
 * signed in as already lives.
 *
 * There are three states, and the page says which one it is rather than
 * pretending they are the same:
 *
 *   refused        signed in with the shared password while accounts exist. The
 *                  shared password carries no identity, so there is nobody to
 *                  attribute "add an account" to; the page explains the way in
 *                  instead of showing controls that would 403.
 *   bootstrap      no accounts exist yet. Anyone already past the gate may
 *                  create the first one — otherwise this page would be
 *                  unreachable without a shell.
 *   manage         signed in as an account. The list, with actions.
 */
export default async function AccountsPage() {
  const { me, guard } = await accountAdminContext();

  if (!guard.ok) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <div>
          <p className="text-sm text-ink-300">Accounts</p>
          <p className="mt-1 text-2xl font-medium">Not available from here</p>
        </div>
        <div className="panel flex flex-col gap-2 p-6">
          <p className="text-ink-100">{guard.error}</p>
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

  const accounts = await listAccounts();
  const rows = accounts.map((account) => ({
    id: account.id,
    username: account.username,
    createdLabel: formatShortDate(account.createdAt),
    lastSeenLabel: account.lastSeenAt ? formatShortDate(account.lastSeenAt) : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-ink-300">Accounts</p>
        <p className="mt-1 text-2xl font-medium">
          {rows.length} {rows.length === 1 ? "identity" : "identities"}
        </p>
      </div>

      <AccountManager
        rows={rows}
        meId={me?.id ?? null}
        bootstrapping={me === null && rows.length === 0}
        minPasswordLength={MIN_PASSWORD_LENGTH}
        usernameRule={USERNAME_RULE}
      />
    </div>
  );
}
