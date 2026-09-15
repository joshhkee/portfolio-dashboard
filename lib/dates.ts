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
