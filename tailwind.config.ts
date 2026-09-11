import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep slate/navy base with a single warm accent — avoids the
        // generic "indigo-500 on white" default Tailwind look.
        ink: {
          950: "#0b0f14",
          900: "#111826",
          800: "#1a2333",
          700: "#243043",
          600: "#334158",
          500: "#4c5c78",
          300: "#93a2ba",
          100: "#e7ecf3",
        },
        gain: "#3ecf8e",
        loss: "#f2545b",
        accent: "#e8a33d",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
