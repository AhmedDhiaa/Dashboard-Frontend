/**
 * DESIGN TOKENS — Single source of truth
 * All values reference CSS custom properties from globals.css.
 * Never import hex/oklch values directly — use these aliases.
 *
 * NOTE: the CSS custom properties hold full OKLCH color values
 * (e.g. `--primary: oklch(0.52 0.14 220)`), so they are referenced BARE
 * as `var(--x)`. Do NOT wrap them in `hsl(...)` — `hsl(oklch(...))` is
 * invalid CSS and resolves to transparent.
 */

// Semantic color aliases (maps to globals.css custom properties)
export const color = {
  // Brand
  primary: "var(--primary)",
  primaryFg: "var(--primary-foreground)",
  secondary: "var(--secondary)",
  secondaryFg: "var(--secondary-foreground)",
  accent: "var(--accent)",
  accentFg: "var(--accent-foreground)",
  // Surface
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  cardFg: "var(--card-foreground)",
  muted: "var(--muted)",
  mutedFg: "var(--muted-foreground)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",
  // Semantic
  success: "var(--success)",
  successFg: "var(--success-foreground)",
  warning: "var(--warning)",
  warningFg: "var(--warning-foreground)",
  destructive: "var(--destructive)",
  destructiveFg: "var(--destructive-foreground)",
  info: "var(--info)",
  infoFg: "var(--info-foreground)",
  // Charts (for recharts — cannot use CSS vars directly)
  chart: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const,
} as const
