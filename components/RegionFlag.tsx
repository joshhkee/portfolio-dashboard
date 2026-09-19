// Simplified flags drawn as inline SVG rather than emoji — flag emoji
// rely on the OS font having glyphs for the Unicode regional-indicator
// sequences, which Windows notably does not reliably render (falls
// back to plain letter pairs like "US"). Pure SVG renders identically
// on every platform. Colors are hand-picked muted tones from the same
// palette as the rest of the app, not the flags' real saturated
// colors, so they read as a quiet accent rather than a bright pop.
const MUTED_RED = "#a56b62";
const MUTED_CREAM = "#c9c3b6";
const MUTED_BLUE = "#5f7d94";

function FlagSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 14"
      width="15"
      height="10.5"
      className="inline-block shrink-0 rounded-[1.5px] align-[-1px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function USFlag() {
  const stripeH = 14 / 7;
  return (
    <FlagSvg>
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} y={i * stripeH} width="20" height={stripeH} fill={i % 2 === 0 ? MUTED_RED : MUTED_CREAM} />
      ))}
      <rect width="9" height={stripeH * 4} fill={MUTED_BLUE} />
    </FlagSvg>
  );
}

function SGFlag() {
  return (
    <FlagSvg>
      <rect width="20" height="7" fill={MUTED_RED} />
      <rect y="7" width="20" height="7" fill={MUTED_CREAM} />
    </FlagSvg>
  );
}

function HKFlag() {
  return (
    <FlagSvg>
      <rect width="20" height="14" fill={MUTED_RED} />
      <circle cx="10" cy="7" r="2.8" fill={MUTED_CREAM} opacity="0.85" />
    </FlagSvg>
  );
}

const FLAGS: Record<string, () => React.ReactElement> = {
  US: USFlag,
  SG: SGFlag,
  HK: HKFlag,
};

/** Region flag for use beside a HEADER label (page/section titles, tab
 * labels) — never inside a table, where it would just add visual noise
 * to a dense row. */
export default function RegionFlag({ region, className = "" }: { region: string; className?: string }) {
  const Flag = FLAGS[region];
  if (!Flag) return null;
  return (
    <span className={`opacity-90 ${className}`}>
      <Flag />
    </span>
  );
}
