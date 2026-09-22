/** Formats a Date as YYYY-MM-DD using its LOCAL calendar fields, for
 * <input type="date"> defaultValues. Deliberately avoids toISOString()
 * for this — that converts through UTC first, which silently rolls the
 * date back a day for any timezone ahead of UTC (e.g. Singapore, UTC+8)
 * whenever the underlying Date was built from local year/month/day
 * (like "the 1st of next month") rather than parsed from an existing
 * UTC timestamp. */
export function toLocalDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Human-readable holding period between two dates, e.g. "3mo", "1y 2mo",
 * "18d" — used for "how long have I held this" displays. Coarse on
 * purpose (years/months/days, not exact), since precision to the day
 * isn't useful once you're holding for months. */
/** Parses a request body's optional date field ("YYYY-MM-DD", "", or null).
 *
 * Returns null for "not provided / deliberately cleared", a Date when it
 * parses, and `undefined` when the value is unusable — so a caller can reject
 * a typo'd date explicitly instead of silently storing an Invalid Date, which
 * Postgres would then refuse with a much less helpful error. */
export function parseOptionalDateInput(value: unknown): Date | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function formatHoldingPeriod(from: Date, to: Date = new Date()): string {
  const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
  if (days < 30) return `${days}d`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  return `${months}mo`;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Formats a transaction/contribution date as "09 Sep 26" — the app's
 * one display format everywhere a date is shown. Deliberately doesn't
 * use toLocaleDateString/Intl at all (not even with a pinned locale):
 * ICU's "short month" for a given locale isn't always a plain 3-letter
 * abbreviation (en-GB gives "Sept", not "Sep"), so this spells out the
 * exact string we want ourselves. It also reads UTC calendar fields,
 * not local ones — these dates are stored as plain UTC-midnight
 * calendar dates (parsed from a bare "YYYY-MM-DD" input), so using
 * local getters would risk shifting the displayed day for any viewer
 * in a timezone behind UTC. */
export function formatShortDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBR[d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}
