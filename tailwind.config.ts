import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['"IBM Plex Sans"',  "system-ui",    "sans-serif"],
        mono:  ['"IBM Plex Mono"',  "ui-monospace",  "monospace"],
        serif: ['"IBM Plex Serif"', "Georgia",       "serif"],
      },

      colors: {
        // surface
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        rule: {
          DEFAULT: "var(--rule)",
          2: "var(--rule-2)",
        },

        // ink
        ink: {
          1: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
          5: "var(--ink-5)",
        },

        // brand & accent
        brand:  "var(--brand)",
        accent: {
          DEFAULT: "var(--accent)",
          hover:   "var(--accent-hover)",
          soft:    "var(--accent-soft)",
          rule:    "var(--accent-rule)",
        },

        // semantic
        issue: {
          DEFAULT: "var(--issue)",
          bg:      "var(--issue-bg)",
          rule:    "var(--issue-rule)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          bg:      "var(--warn-bg)",
          rule:    "var(--warn-rule)",
        },
        ok: {
          DEFAULT: "var(--ok)",
          bg:      "var(--ok-bg)",
          rule:    "var(--ok-rule)",
        },

        // shadcn shim — kept so existing utility classes don't break mid-migration
        background:  "var(--surface)",
        foreground:  "var(--ink-1)",
        primary: {
          DEFAULT:    "var(--accent)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT:    "var(--surface-2)",
          foreground: "var(--ink-1)",
        },
        destructive: {
          DEFAULT:    "var(--issue)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT:    "var(--surface-2)",
          foreground: "var(--ink-3)",
        },
        border: "var(--rule)",
        input:  "var(--rule)",
        ring:   "var(--accent)",
      },

      borderRadius: {
        none: "0",
        sm:   "4px",      // chips, level pills
        DEFAULT: "6px",   // buttons, inputs
        md:   "8px",      // banners, cards
        lg:   "12px",     // large panels
        xl:   "16px",
        full: "9999px",   // badges, progress
      },
    },
  },
  plugins: [],
};

export default config;
