import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm dark-grey "private banking terminal" palette — quiet,
        // not a navy/slate crypto-app look. Kept under the existing
        // `ink` key (rather than renaming to bg-primary/text-secondary
        // etc. throughout every component) so this redesign is a
        // values-only change: every existing ink-XXX/gain/loss/accent
        // class reference across the app repaints automatically.
        ink: {
          950: "#121212", // page background
          900: "#1a1a1a", // cards, panels, nav
          850: "#1d1d1d", // table header row — a step between 900 and 800
          800: "#212121", // modals, hover states
          700: "#2e2e2e", // hairline borders/dividers
          600: "#3a3a3a", // slightly stronger border (footer totals, emphasis)
          // Timestamps, hints, disabled states, placeholder "—".
          // Was #6b6862, which measured only 3.04–3.37:1 against the three
          // background levels — below the 4.5:1 AA floor for the small text
          // it's used for in 17 places. #8f8b85 clears it everywhere it
          // lands, including the worst case (modals at #212121 → 4.75:1),
          // while staying a quiet warm grey.
          500: "#8f8b85",
          300: "#a3a099", // labels, captions, muted body text
          100: "#e8e6e1", // primary text/headings — warm off-white, never pure white
        },
        gain: "#7fa87a", // muted sage — desaturated on purpose, not neon
        gainBg: "#1c2620",
        // Muted terracotta — desaturated on purpose, not neon. Was #b06d64,
        // which fell to 4.32:1 on panels and 4.19:1 on table headers (both
        // below AA); #c07f74 holds ≥5.0:1 everywhere including the loss
        // badge background. Gains and losses also always carry an explicit
        // +/− sign, so they never rely on hue alone.
        loss: "#c07f74",
        lossBg: "#2a1e1c",
        accent: "#d4a94a", // muted gold — UI chrome only, not charts/data
        accentHover: "#e0bb63",
        accentMuted: "#3a331f",
      },
      fontFamily: {
        // Base UI font is serif per the brand direction — Source Serif 4
        // over literal Times New Roman for screen legibility at small
        // sizes. Numbers/data go through font-mono (tabular-nums) so
        // columns align.
        sans: ["var(--font-serif)", "Georgia", "serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
