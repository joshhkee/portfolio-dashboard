const FLAG: Record<string, string> = {
  US: "🇺🇸",
  SG: "🇸🇬",
  HK: "🇭🇰",
};

/** Region flag for use beside a HEADER label (page/section titles, tab
 * labels) — never inside a table, where it would just add visual noise
 * to a dense row. Desaturated and slightly transparent on purpose:
 * flags are inherently saturated/high-contrast by nature, which clashes
 * with the muted palette everywhere else, so this dials them back
 * rather than letting them pop. */
export default function RegionFlag({ region, className = "" }: { region: string; className?: string }) {
  const flag = FLAG[region];
  if (!flag) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-block saturate-[0.4] opacity-75 ${className}`}
    >
      {flag}
    </span>
  );
}
