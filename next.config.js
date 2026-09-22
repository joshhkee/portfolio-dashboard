/**
 * Old route names, kept working.
 *
 * The app was reorganised into five objects (Today, Positions, Performance,
 * Money, Watchlist), and every URL that used to name a REPORT now resolves to
 * the object that owns it. These live in the config rather than as stub pages
 * because only the config can forward a path SUFFIX: `/holdings/us?ticker=D05`
 * has to arrive at `/positions/us?ticker=D05`, which a redirect page cannot do
 * without hand-parsing the query.
 *
 * `permanent: false` on purpose — these are a convenience for bookmarks and
 * muscle memory, not a contract, and a 308 would make a later rename stick in
 * every browser cache.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Cash is money, not a position — and this has to be listed BEFORE the
      // /holdings/:path* rule below, because that rule would otherwise send
      // /holdings/cash to a /positions/cash that does not exist. Order matters:
      // Next matches these top to bottom.
      { source: "/holdings/cash", destination: "/money/cash", permanent: false },
      { source: "/cash", destination: "/money/cash", permanent: false },
      // Holdings -> Positions. The bare path opens on the US tab, exactly as
      // the old index page did.
      { source: "/holdings", destination: "/positions/us", permanent: false },
      { source: "/holdings/:path*", destination: "/positions/:path*", permanent: false },
      // The two lenses, which used to be top-level peers of the objects they
      // are a view of.
      { source: "/exposure", destination: "/positions/exposure", permanent: false },
      { source: "/attribution", destination: "/performance/attribution", permanent: false },
      // The trade ledger is position history (it is what built the positions),
      // and realized trades are a performance result.
      { source: "/transactions", destination: "/positions/trades", permanent: false },
      { source: "/completed-trades", destination: "/performance/realized", permanent: false },
      // Outlay is the Money object under its old report-flavoured name, and the
      // two names before that.
      { source: "/outlay", destination: "/money", permanent: false },
      { source: "/portfolio", destination: "/money", permanent: false },
      { source: "/contributions", destination: "/money", permanent: false },
    ];
  },
};

module.exports = nextConfig;
