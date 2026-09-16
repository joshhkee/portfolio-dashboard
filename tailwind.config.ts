import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base — grey-dark, never pure black.
        page: "#121212",
        sunken: "#141414", // input wells / inset areas
        surface: {
          DEFAULT: "#1a1a1a", // cards, panels
          raised: "#212121", // modals, hover states
          header: "#1d1d1d", // table header row (a step between the two)
        },
        // Hairline dividers — kept subtle, not high contrast.
        line: {
          DEFAULT: "#2e2e2e",
          strong: "#3a3a3a",
        },
        // Text — warm off-white, never pure white/grey.
        fg: {
          DEFAULT: "#e8e6e1", // numbers, headings
          muted: "#a3a099", // labels, captions
          subtle: "#6b6862", // timestamps, disabled, placeholders
        },
        // Muted gold. UI chrome only (CTAs, active nav, key totals) —
        // deliberately kept out of the charts.
        accent: {
          DEFAULT: "#d4a94a",
          hover: "#e0bb63",
          muted: "#3a331f",
        },
        // Desaturated gain/loss — sage green and brick red, not neon.
        positive: {
          DEFAULT: "#7fa87a",
          wash: "#1c2620",
        },
        negative: {
          DEFAULT: "#b06d64",
          wash: "#2a1e1c",
        },
      },
      fontFamily: {
        // Body copy is serif; Source Serif 4 is loaded in app/layout.tsx
        // and exposed as --font-serif (falls back to Georgia).
        sans: ["var(--font-serif)", "Source Serif 4", "Georgia", "Cambria", "serif"],
        serif: ["var(--font-serif)", "Source Serif 4", "Georgia", "Cambria", "serif"],
        // Figures only — see the .num utility.
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      // Small-caps table headers and micro labels.
      letterSpacing: {
        label: "0.12em",
      },
      // 6–10px: precise/financial rather than playful.
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
