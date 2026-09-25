// Simplified flags drawn as inline SVG rather than emoji — flag emoji
// rely on the OS font having glyphs for the Unicode regional-indicator
// sequences, which Windows notably does not reliably render (falls
// back to plain letter pairs like "US"). Pure SVG renders identically
// on every platform. Colors are hand-picked muted tones from the same
// palette as the rest of the app, not the flags' real saturated
// colors, so they read as a quiet accent rather than a bright pop.
//
// Redrawn once, after the flags came back to the region headings they
// lost with the region tabs. What changed and why, in the order it
// matters at 16px:
//
//  - Every flag is drawn to a hairline edge. Without one, a light field
//    (SG's cream half, US's cream stripes) ended in a soft antialiased
//    boundary against a dark panel and the shape looked smudged rather
//    than drawn. The ring is `ink-700`, the same hairline the panels and
//    table borders use, so a flag reads as one more bordered object
//    instead of a cut-out.
//  - The US stripes are rendered with `shapeRendering="crispEdges"` and
//    only the stripes: at this height each stripe is about 1.6px, which
//    antialiases into a pink-red mush, and snapping those edges to the
//    pixel grid is what makes them read as stripes. The curves (the
//    crescent, the petals) keep smooth rendering — snapping a 2px circle
//    to the grid makes it a square.
//  - The canton is 40% of the width, which is the real flag's ratio
//    rather than the 45% the first draft used.
//  - Hong Kong is a flower now, not a disc. A red field with a pale
//    circle in the middle is Japan's flag, and that is what the single
//    circle read as; five petals around a centre is the bauhinia, and it
//    is distinguishable at this size by SHAPE rather than by remembered
//    colour.
const MUTED_RED = "#a56b62";
const MUTED_CREAM = "#c9c3b6";
const MUTED_BLUE = "#5f7d94";
/** ink-700 — the app's hairline border, reused as the flag's edge. */
const MUTED_EDGE = "#2e2e2e";

function FlagSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 14"
      width="16"
      height="11.2"
      className="inline-block shrink-0 rounded-[2px] align-[-1px]"
      aria-hidden="true"
    >
      {children}
      {/* The edge, drawn last so it sits over the colours. `0.5` insets it by
          half its width, which is what keeps a 1px stroke inside the viewBox
          instead of half-clipped at the boundary. */}
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="13"
        rx="2"
        fill="none"
        stroke={MUTED_EDGE}
        strokeWidth="1"
      />
    </svg>
  );
}

function USFlag() {
  // Seven stripes rather than the real thirteen: at 11px of height thirteen
  // stripes are 0.86px each and lose their identity, while seven still read as
  // "striped" and leave the canton tall enough to be a block of colour. The
  // stripe sequence starts and ends on red, as the real flag does.
  const stripeH = 14 / 7;
  return (
    <FlagSvg>
      {Array.from({ length: 7 }).map((_, i) => (
        <rect
          key={i}
          y={i * stripeH}
          width="20"
          height={stripeH}
          fill={i % 2 === 0 ? MUTED_RED : MUTED_CREAM}
          shapeRendering="crispEdges"
        />
      ))}
      <rect width="8" height={stripeH * 4} fill={MUTED_BLUE} shapeRendering="crispEdges" />
    </FlagSvg>
  );
}

function SGFlag() {
  return (
    <FlagSvg>
      <rect width="20" height="7" fill={MUTED_RED} shapeRendering="crispEdges" />
      <rect y="7" width="20" height="7" fill={MUTED_CREAM} shapeRendering="crispEdges" />
      {/* Crescent moon (a cream circle with a red circle overlapping to
          "bite" a crescent out of it) plus five stars, simplified to
          small dots at this size — the cluster is what distinguishes
          this from Indonesia's flag, which is the same red-over-white
          without them. */}
      <circle cx="3.9" cy="3.4" r="2.2" fill={MUTED_CREAM} />
      <circle cx="4.7" cy="3" r="1.9" fill={MUTED_RED} />
      <circle cx="9.6" cy="1.2" r="0.5" fill={MUTED_CREAM} />
      <circle cx="11.7" cy="2.7" r="0.5" fill={MUTED_CREAM} />
      <circle cx="10.9" cy="5.2" r="0.5" fill={MUTED_CREAM} />
      <circle cx="8.3" cy="5.2" r="0.5" fill={MUTED_CREAM} />
      <circle cx="7.5" cy="2.7" r="0.5" fill={MUTED_CREAM} />
    </FlagSvg>
  );
}

/** Five petals at a fixed radius around the centre — the bauhinia, at the
 *  smallest size at which a flower still reads as a flower. */
const HK_PETALS = Array.from({ length: 5 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
  return { cx: 10 + Math.cos(angle) * 2, cy: 7 + Math.sin(angle) * 2 };
});

function HKFlag() {
  return (
    <FlagSvg>
      <rect width="20" height="14" fill={MUTED_RED} shapeRendering="crispEdges" />
      {HK_PETALS.map((petal, i) => (
        <circle key={i} cx={petal.cx} cy={petal.cy} r="1.15" fill={MUTED_CREAM} />
      ))}
      <circle cx="10" cy="7" r="0.85" fill={MUTED_CREAM} opacity="0.85" />
    </FlagSvg>
  );
}

const FLAGS: Record<string, () => React.ReactElement> = {
  US: USFlag,
  SG: SGFlag,
  HK: HKFlag,
};

/** Region flag for use beside a HEADER label (page/section titles, the region
 *  headings above each market's table) — never inside a table, where it would
 *  just add visual noise to a dense row. It is a landmark beside a word, never
 *  a label on its own: the region code stays next to it, so nothing depends on
 *  reading a 16px picture. */
export default function RegionFlag({ region, className = "" }: { region: string; className?: string }) {
  const Flag = FLAGS[region];
  if (!Flag) return null;
  return (
    <span className={`opacity-90 ${className}`}>
      <Flag />
    </span>
  );
}
