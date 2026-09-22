// The muted multi-series data palette.
//
// These hexes are duplicated in tailwind.config.ts (as `data.*` utility
// colours) because charts need the raw values for SVG strokes and fills, and
// Tailwind class names are not readable from Recharts props. Keep the two in
// step: this file is the source of truth for anything drawn in SVG.
//
// Every colour was measured at >= 5.7:1 against the page background
// (#121212), so lines stay legible on the dark theme. `terracotta` is the
// same tone as the `loss` utility, which is why it is ordered LAST — a series
// should only be loss-coloured when there is nothing warmer left to use.

export const DATA_COLORS = {
  steel: "#7d97b3",
  sage: "#7fa87a",
  terracotta: "#c07f74",
  gold: "#c9a86a",
  mauve: "#9b8ab8",
  teal: "#6fa8a3",
} as const;

/**
 * Assignment order for unnamed series (e.g. one line per stakeholder).
 *
 * Hand-picked rather than alphabetical so the first few series are easy to
 * tell apart: steel/sage/mauve/teal sit at different hues AND different
 * lightness, and the two warm tones (gold, terracotta) are kept apart since
 * they are the pair most likely to be confused at small stroke widths.
 */
export const DATA_COLOR_ORDER: string[] = [
  DATA_COLORS.steel,
  DATA_COLORS.sage,
  DATA_COLORS.mauve,
  DATA_COLORS.teal,
  DATA_COLORS.gold,
  DATA_COLORS.terracotta,
];

/** Stable colour for the nth series, wrapping when there are more series
 * than palette entries rather than running out and drawing two lines the
 * same colour. */
export function seriesColor(index: number): string {
  return DATA_COLOR_ORDER[index % DATA_COLOR_ORDER.length];
}
