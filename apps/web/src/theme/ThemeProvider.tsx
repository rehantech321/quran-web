import { useEffect, type ReactNode } from "react";

import type { OrgTheme } from "@halaqat/shared";

/**
 * theme.css ships the full default palette as flat hex values — that stays
 * the fallback and is never touched. When an organization overrides
 * `theme.primary`/`accent`/`sage` (SPEC.md §2.1: "All colors are per-organization
 * overridable at runtime by injecting the org's palette into :root"), this sets
 * just those three base tokens and derives the rest of each ramp via
 * `color-mix()` — so a mosque only ever needs to pick three colors, not a full
 * six-step Tailwind-style scale.
 */
const PRIMARY_DERIVED: Record<string, string> = {
  "--c-primary-950": "color-mix(in srgb, var(--c-primary-900) 70%, black)",
  "--c-primary-800": "color-mix(in srgb, var(--c-primary-900) 85%, white)",
  "--c-primary-700": "color-mix(in srgb, var(--c-primary-900) 75%, white)",
  "--c-primary-600": "color-mix(in srgb, var(--c-primary-900) 60%, white)",
  "--c-primary-500": "color-mix(in srgb, var(--c-primary-900) 45%, white)",
};

const GOLD_DERIVED: Record<string, string> = {
  "--c-gold-600": "color-mix(in srgb, var(--c-gold-500) 85%, black)",
  "--c-gold-400": "color-mix(in srgb, var(--c-gold-500) 80%, white)",
  "--c-gold-100": "color-mix(in srgb, var(--c-gold-500) 25%, white)",
};

const SAGE_DERIVED: Record<string, string> = {
  "--c-sage-300": "color-mix(in srgb, var(--c-sage-400) 80%, white)",
  "--c-sage-100": "color-mix(in srgb, var(--c-sage-400) 30%, white)",
};

export interface ThemeProviderProps {
  /** The organization's theme override, or undefined to use the built-in default palette. */
  theme?: Partial<OrgTheme>;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const touched: string[] = [];

    if (theme?.primary) {
      root.style.setProperty("--c-primary-900", theme.primary);
      touched.push("--c-primary-900");
      for (const [token, value] of Object.entries(PRIMARY_DERIVED)) {
        root.style.setProperty(token, value);
        touched.push(token);
      }
    }
    if (theme?.accent) {
      root.style.setProperty("--c-gold-500", theme.accent);
      touched.push("--c-gold-500");
      for (const [token, value] of Object.entries(GOLD_DERIVED)) {
        root.style.setProperty(token, value);
        touched.push(token);
      }
    }
    if (theme?.sage) {
      root.style.setProperty("--c-sage-400", theme.sage);
      touched.push("--c-sage-400");
      for (const [token, value] of Object.entries(SAGE_DERIVED)) {
        root.style.setProperty(token, value);
        touched.push(token);
      }
    }

    return () => {
      for (const token of touched) root.style.removeProperty(token);
    };
  }, [theme?.primary, theme?.accent, theme?.sage]);

  return children;
}
