import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          950: "var(--c-primary-950)",
          900: "var(--c-primary-900)",
          800: "var(--c-primary-800)",
          700: "var(--c-primary-700)",
          600: "var(--c-primary-600)",
          500: "var(--c-primary-500)",
        },
        sage: {
          400: "var(--c-sage-400)",
          300: "var(--c-sage-300)",
          100: "var(--c-sage-100)",
        },
        gold: {
          600: "var(--c-gold-600)",
          500: "var(--c-gold-500)",
          400: "var(--c-gold-400)",
          100: "var(--c-gold-100)",
        },
        cream: {
          50: "var(--c-cream-50)",
          100: "var(--c-cream-100)",
          200: "var(--c-cream-200)",
        },
        ink: {
          900: "var(--c-ink-900)",
          600: "var(--c-ink-600)",
          400: "var(--c-ink-400)",
        },
        success: "var(--c-success)",
        danger: "var(--c-danger)",
        warning: "var(--c-warning)",
        info: "var(--c-info)",
      },
      fontFamily: {
        arabic: ["IBM Plex Sans Arabic", "Tahoma", "sans-serif"],
        display: ["Amiri", "IBM Plex Sans Arabic", "serif"],
        latin: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(11,59,46,0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
