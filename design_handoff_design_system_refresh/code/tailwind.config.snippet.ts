// Drop these `colors`, `fontFamily`, and `borderRadius` blocks into the
// `extend` section of tailwind.config.ts, REPLACING the current values.
//
// The existing shadcn-style aliases (`primary`, `secondary`, `border`, etc.)
// still resolve through the compatibility shim in globals.css, so any
// existing utility classes won't break on the first commit. Migrate them
// to the named tokens incrementally.

import type { Config } from "tailwindcss";

const extend: Config["theme"] = {
  extend: {
    fontFamily: {
      sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      serif: ['"IBM Plex Serif"', "Georgia", "serif"], // hero / large display only
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

      // brand
      brand: "var(--brand)",
      accent: {
        DEFAULT: "var(--accent)",
        hover: "var(--accent-hover)",
        soft: "var(--accent-soft)",
        rule: "var(--accent-rule)",
      },

      // semantic
      issue: {
        DEFAULT: "var(--issue)",
        bg: "var(--issue-bg)",
        rule: "var(--issue-rule)",
      },
      warn: {
        DEFAULT: "var(--warn)",
        bg: "var(--warn-bg)",
        rule: "var(--warn-rule)",
      },
      ok: {
        DEFAULT: "var(--ok)",
        bg: "var(--ok-bg)",
        rule: "var(--ok-rule)",
      },

      // shadcn shim — kept so existing classes don't break mid-migration
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "var(--primary)",
        foreground: "var(--primary-foreground)",
      },
      secondary: {
        DEFAULT: "var(--secondary)",
        foreground: "var(--secondary-foreground)",
      },
      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-foreground)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-foreground)",
      },
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
    },

    borderRadius: {
      none: "0",
      sm: "4px",   // chips, level pills
      DEFAULT: "6px", // buttons, inputs
      md: "8px",   // banners, cards
      lg: "12px",  // large panels
      xl: "16px",
      full: "9999px", // badges, progress
    },
  },
};

export default { theme: extend };
