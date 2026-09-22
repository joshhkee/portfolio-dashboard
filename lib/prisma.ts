import { PrismaClient } from "@prisma/client";

/**
 * Pool size override.
 *
 * `connection_limit=1` is deliberate, and it is a measured fix rather than a
 * theoretical one. The database is a remote Supabase pooler, and from this
 * machine five warm queries cost:
 *
 *   connection_limit=5, issued in parallel -> 723ms per query
 *   connection_limit=5, issued in sequence -> 389ms per query
 *   connection_limit=1, issued in parallel -> 263ms per query
 *
 * Opening a connection to that pooler costs ~2.4-3.5s, so every extra pooled
 * connection the app opens costs more than the parallelism buys back. The pages
 * here fire their reads through `Promise.all`, which with a five-connection
 * pool opened several at once — and under concurrent page loads the pool
 * starved outright: the dev log holds 31 `P2024 "Timed out fetching a new
 * connection from the connection pool"` failures, whose 10s timeout was itself
 * a large part of the "slow page loads" complaint.
 *
 * Prisma queues queries correctly on a single connection, so one reused
 * connection is both faster per query and immune to that starvation. Set
 * `PRISMA_CONNECTION_LIMIT` to opt out — a local Postgres, where connecting is
 * nearly free, is the case where the trade-off does not apply.
 */
function datasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;

  const limit = process.env.PRISMA_CONNECTION_LIMIT ?? "1";
  // Replace rather than append: a second connection_limit in the query string
  // is ambiguous, and the point of this function is that ours wins.
  const withoutLimit = base.replace(/([?&])connection_limit=\d+&?/g, "$1").replace(/[?&]$/, "");
  const separator = withoutLimit.includes("?") ? "&" : "?";
  // pool_timeout is raised alongside it: with one connection the queue is
  // expected, and Prisma's 10s default is what turned a busy moment into a
  // hard P2024 error.
  return `${withoutLimit}${separator}connection_limit=${limit}&pool_timeout=30`;
}

/**
 * Build the client, overriding the pool only when there is a URL to override
 * it with.
 *
 * Prisma rejects an explicit `undefined` for a datasource — `new
 * PrismaClient({ datasources: { db: { url: undefined } } })` throws "Invalid
 * value undefined for datasource \"db\"" — whereas the bare `new
 * PrismaClient()` simply resolves DATABASE_URL later, at connect time. That
 * difference is fatal exactly where the client is constructed without the
 * variable set: `next build` imports every route module to collect metadata,
 * so a build machine with no DATABASE_URL (a Vercel preview deployment, say)
 * fails the BUILD instead of failing a query at runtime. This override must
 * therefore be additive: no URL, no override, and the default behaviour —
 * which is what every environment had before this file grew a pool override.
 */
function createPrismaClient(): PrismaClient {
  const url = datasourceUrl();
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

// Kept in every environment, not just dev: a Next server process can re-evaluate
// this module (dev HMR, or a second worker), and each new client would open its
// own pool — which is how a five-connection limit ends up behaving like fifteen.
globalForPrisma.prisma = prisma;
