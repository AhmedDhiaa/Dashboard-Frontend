/**
 * Chart Color Tokens
 *
 * Recharts and other SVG-based chart libs accept CSS color strings for their
 * `fill` / `stroke` / `color` props. These tokens are CSS-variable references
 * that resolve at paint time, so charts automatically repaint when the user
 * switches theme preset (light/dark/high-contrast/etc.) — no JS color
 * resolution, no `getComputedStyle()`, no re-render dance required.
 *
 * Two flavors:
 *
 *   - `chartSeries` — categorical palette for distinguishing series within a
 *     single chart (bar segments, pie slices, multi-line charts). Five colors
 *     because that's what `--chart-1` … `--chart-5` define in globals.css.
 *
 *   - `chartSemantic` — status/severity colors. Use these when the color
 *     carries meaning (success/warning/destructive/info) rather than being
 *     just "the next color in the rotation."
 *
 * Do NOT pass raw hex literals to chart components: the design-token ESLint
 * rule does not catch hex inside chart props or array literals, so any hex
 * value silently bypasses the theme. Dark mode users see light-mode charts.
 *
 * @module ui/theme/chart-tokens
 */

export const chartSeries = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export const chartSemantic = {
  primary: "var(--primary)",
  secondary: "var(--secondary)",
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  info: "var(--info)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  border: "var(--border)",
  foreground: "var(--foreground)",
  background: "var(--background)",
} as const
