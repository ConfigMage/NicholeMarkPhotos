import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm off-white / cream background
        cream: "#FAF6F1",
        // Soft white surfaces / cards
        surface: "#FFFFFF",
        // Dusty rose primary accent (+ deep muted rose for buttons/hover)
        rose: {
          DEFAULT: "#C9A0A4",
          deep: "#B07E84",
        },
        // Sage green secondary accent
        sage: {
          DEFAULT: "#9CAF94",
          deep: "#84997B",
        },
        // Supporting pastels
        blush: "#F3DCDC",
        "pale-sage": "#DCE6D5",
        // Text
        charcoal: "#403A38",
        "warm-gray": "#8A817C",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px -10px rgba(64, 58, 56, 0.18)",
        tile: "0 2px 14px -4px rgba(64, 58, 56, 0.14)",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
