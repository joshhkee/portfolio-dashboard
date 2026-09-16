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
          500: "#6b6862", // timestamps, disabled, placeholder "—"
          300: "#a3a099", // labels, captions, muted body text
          100: "#e8e6e1", // primary text/headings — warm off-white, never pure white
        },
        gain: "#7fa87a", // muted sage — desaturated on purpose, not neon
        gainBg: "#1c2620",
        loss: "#b06d64", // muted terracotta — desaturated on purpose, not neon
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
