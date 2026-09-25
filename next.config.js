/**
 * Old route names, kept working.
 *
 * The app was reorganised into five objects (Today, Positions, Performance,
 * Money, Watchlist), and every URL that used to name a REPORT now resolves to
 * the object that owns it. These live in the config rather than as stub pages
 * because only the config can forward a path SUFFIX: `/holdings/us?ticker=D05`
 * has to arrive at `/positions/holdings?ticker=D05`, which a redirect page
 * cannot do without hand-parsing the query.
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
      // The ledger used to be named after one of the two things it holds. The
      // rename is the tab's, but the path moved with it so the URL and the tab
      // cannot disagree — and this rule is what keeps every existing bookmark,
      // browser tab and shared link working. Listed first because a redirect to
      // a path that is itself redirected is a second round trip.
      { source: "/positions/trades", destination: "/positions/transactions", permanent: false },
      // Cash is money, not a position — and this has to be listed BEFORE the
      // /holdings/:path* rule below, because that rule would otherwise send
      // /holdings/cash to a /positions/cash that does not exist. Order matters:
      // Next matches these top to bottom.
      { source: "/holdings/cash", destination: "/money/cash", permanent: false },
      { source: "/cash", destination: "/money/cash", permanent: false },
      // Holdings -> the holdings page. The bare path used to open on the US tab,
      // which made the section look region-first; there is one table now,
      // covering all three markets.
      { source: "/holdings", destination: "/positions/holdings", permanent: false },
      // The three region pages collapsed into one. These forward rather than
      // 404 because `/positions/us?ticker=D05` is how the command palette
      // deep-links a holding, and the query string has to survive — the same
      // reason the rules in this file are config rather than pages. Listed
      // before the generic rule below, or a bookmarked region URL would take
      // two hops through a page that no longer exists.
      {
        source: "/holdings/:region(us|sg|hk)",
        destination: "/positions/holdings",
        permanent: false,
      },
      {
        source: "/positions/:region(us|sg|hk)",
        destination: "/positions/holdings",
        permanent: false,
      },
      { source: "/holdings/:path*", destination: "/positions/:path*", permanent: false },
      // The two lenses, which used to be top-level peers of the objects they
      // are a view of.
      { source: "/exposure", destination: "/positions/exposure", permanent: false },
      { source: "/attribution", destination: "/performance/attribution", permanent: false },
      // The transaction ledger is position history (it is what built the
      // positions), and realized trades are a performance result.
      { source: "/transactions", destination: "/positions/transactions", permanent: false },
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
