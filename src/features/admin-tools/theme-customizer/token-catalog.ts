/**
 * Comprehensive token catalog driving the Theme Studio.
 *
 * The schema isn't a hard validator — admins can publish any
 * `Record<string, string>` via the API — it just drives which controls each
 * group renders and what their REAL default values are. Every `defaultValue`
 * below is copied verbatim from the light `:root` block in
 * `src/app/globals.css`, so a control with no draft/live override still shows
 * the true current value (never "(default)").
 *
 * Token VALUES are full CSS values consumed as `var(--token)`:
 *  - colors are `oklch(...)` (a `#rrggbb` from the native picker is equally
 *    valid and stored verbatim),
 *  - sizes are `rem` / `px`,
 *  - a few are unitless numbers (font-scale, shadow-strength, weights).
 *
 * NOTE: the override layer is `:root` (light mode) only. The Mode toggle is a
 * light/dark PREVIEW via next-themes; editing dark-mode-specific values is out
 * of scope.
 */

export type TokenInput = "color" | "slider" | "select" | "text"

export interface TokenSpec {
  /** CSS custom property name including leading `--`. */
  key: string
  /** Human-readable label. */
  label: string
  /** Group id this token belongs to. */
  group: string
  /** Picks the control widget. */
  input: TokenInput
  /** REAL default value from globals.css light `:root`. */
  defaultValue: string
  /** Optional hint shown beneath the control. */
  hint?: string
  /** Slider bounds (rem/px/unitless depending on `unit`). */
  min?: number
  max?: number
  step?: number
  /** Unit suffix written back with slider values ("rem" | "px" | ""). */
  unit?: string
  /** Curated quick-pick values for slider controls. */
  picks?: { label: string; value: string }[]
  /** Options for select controls. */
  options?: { label: string; value: string }[]
}

/* ============================================================================
   COLORS
   ============================================================================ */

const COLOR_HINT = "any CSS color — oklch(0.55 0.12 220), #2563eb, or a name"

/** Curated swatch suggestions offered under every color control. */
export const COLOR_SUGGESTIONS: string[] = [
  "oklch(0.52 0.14 220)", // brand blue
  "oklch(0.55 0.20 275)", // indigo
  "oklch(0.60 0.13 195)", // teal
  "oklch(0.58 0.16 150)", // emerald
  "oklch(0.66 0.16 65)", // amber
  "oklch(0.55 0.22 25)", // red
  "oklch(0.55 0.22 300)", // violet
  "oklch(0.58 0.22 12)", // rose
  "oklch(0.20 0.015 240)", // near-black ink
  "oklch(0.99 0.002 240)", // near-white
]

export const COLOR_TOKENS: TokenSpec[] = [
  // Surfaces & Text
  { key: "--background", label: "Background", group: "surfaces", input: "color", defaultValue: "oklch(0.985 0.003 240)", hint: COLOR_HINT },
  { key: "--foreground", label: "Foreground", group: "surfaces", input: "color", defaultValue: "oklch(0.20 0.015 240)", hint: COLOR_HINT },
  { key: "--card", label: "Card surface", group: "surfaces", input: "color", defaultValue: "oklch(1 0 0)", hint: COLOR_HINT },
  { key: "--card-foreground", label: "Card foreground", group: "surfaces", input: "color", defaultValue: "oklch(0.20 0.015 240)", hint: COLOR_HINT },
  { key: "--popover", label: "Popover surface", group: "surfaces", input: "color", defaultValue: "oklch(1 0 0)", hint: COLOR_HINT },
  { key: "--popover-foreground", label: "Popover foreground", group: "surfaces", input: "color", defaultValue: "oklch(0.20 0.015 240)", hint: COLOR_HINT },
  { key: "--muted", label: "Muted surface", group: "surfaces", input: "color", defaultValue: "oklch(0.965 0.005 240)", hint: COLOR_HINT },
  { key: "--muted-foreground", label: "Muted foreground", group: "surfaces", input: "color", defaultValue: "oklch(0.50 0.018 240)", hint: COLOR_HINT },
  { key: "--border", label: "Border", group: "surfaces", input: "color", defaultValue: "oklch(0.91 0.008 240)", hint: COLOR_HINT },
  { key: "--input", label: "Input surface", group: "surfaces", input: "color", defaultValue: "oklch(0.97 0.005 240)", hint: COLOR_HINT },

  // Brand
  { key: "--primary", label: "Primary", group: "brand", input: "color", defaultValue: "oklch(0.52 0.14 220)", hint: COLOR_HINT },
  { key: "--primary-foreground", label: "Primary foreground", group: "brand", input: "color", defaultValue: "oklch(0.99 0.002 220)", hint: COLOR_HINT },
  { key: "--secondary", label: "Secondary", group: "brand", input: "color", defaultValue: "oklch(0.94 0.012 220)", hint: COLOR_HINT },
  { key: "--secondary-foreground", label: "Secondary foreground", group: "brand", input: "color", defaultValue: "oklch(0.25 0.02 220)", hint: COLOR_HINT },
  { key: "--accent", label: "Accent", group: "brand", input: "color", defaultValue: "oklch(0.65 0.15 200)", hint: COLOR_HINT },
  { key: "--accent-foreground", label: "Accent foreground", group: "brand", input: "color", defaultValue: "oklch(0.99 0.002 200)", hint: COLOR_HINT },
  { key: "--ring", label: "Focus ring", group: "brand", input: "color", defaultValue: "oklch(0.52 0.14 220)", hint: COLOR_HINT },

  // Status / semantic
  { key: "--success", label: "Success", group: "status", input: "color", defaultValue: "oklch(0.58 0.16 150)", hint: COLOR_HINT },
  { key: "--success-foreground", label: "Success foreground", group: "status", input: "color", defaultValue: "oklch(0.99 0.002 150)", hint: COLOR_HINT },
  { key: "--warning", label: "Warning", group: "status", input: "color", defaultValue: "oklch(0.72 0.16 70)", hint: COLOR_HINT },
  { key: "--warning-foreground", label: "Warning foreground", group: "status", input: "color", defaultValue: "oklch(0.22 0.025 70)", hint: COLOR_HINT },
  { key: "--destructive", label: "Destructive", group: "status", input: "color", defaultValue: "oklch(0.55 0.22 25)", hint: COLOR_HINT },
  { key: "--destructive-foreground", label: "Destructive foreground", group: "status", input: "color", defaultValue: "oklch(0.99 0.002 25)", hint: COLOR_HINT },
  { key: "--info", label: "Info", group: "status", input: "color", defaultValue: "oklch(0.58 0.14 245)", hint: COLOR_HINT },
  { key: "--info-foreground", label: "Info foreground", group: "status", input: "color", defaultValue: "oklch(0.99 0.002 245)", hint: COLOR_HINT },
  { key: "--premium", label: "Premium", group: "status", input: "color", defaultValue: "oklch(0.55 0.22 285)", hint: COLOR_HINT },
  { key: "--premium-foreground", label: "Premium foreground", group: "status", input: "color", defaultValue: "oklch(0.99 0.002 285)", hint: COLOR_HINT },

  // Sidebar
  { key: "--sidebar", label: "Sidebar surface", group: "sidebar", input: "color", defaultValue: "oklch(0.975 0.004 240)", hint: COLOR_HINT },
  { key: "--sidebar-foreground", label: "Sidebar foreground", group: "sidebar", input: "color", defaultValue: "oklch(0.28 0.018 240)", hint: COLOR_HINT },
  { key: "--sidebar-primary", label: "Sidebar primary", group: "sidebar", input: "color", defaultValue: "oklch(0.52 0.14 220)", hint: COLOR_HINT },
  { key: "--sidebar-primary-foreground", label: "Sidebar primary foreground", group: "sidebar", input: "color", defaultValue: "oklch(0.99 0.002 220)", hint: COLOR_HINT },
  { key: "--sidebar-accent", label: "Sidebar accent", group: "sidebar", input: "color", defaultValue: "oklch(0.93 0.012 220)", hint: COLOR_HINT },
  { key: "--sidebar-accent-foreground", label: "Sidebar accent foreground", group: "sidebar", input: "color", defaultValue: "oklch(0.30 0.025 220)", hint: COLOR_HINT },
  { key: "--sidebar-border", label: "Sidebar border", group: "sidebar", input: "color", defaultValue: "oklch(0.91 0.008 240)", hint: COLOR_HINT },
  { key: "--sidebar-ring", label: "Sidebar ring", group: "sidebar", input: "color", defaultValue: "oklch(0.52 0.14 220)", hint: COLOR_HINT },

  // Charts
  { key: "--chart-1", label: "Chart 1", group: "charts", input: "color", defaultValue: "oklch(0.55 0.14 220)", hint: COLOR_HINT },
  { key: "--chart-2", label: "Chart 2", group: "charts", input: "color", defaultValue: "oklch(0.66 0.15 165)", hint: COLOR_HINT },
  { key: "--chart-3", label: "Chart 3", group: "charts", input: "color", defaultValue: "oklch(0.70 0.16 70)", hint: COLOR_HINT },
  { key: "--chart-4", label: "Chart 4", group: "charts", input: "color", defaultValue: "oklch(0.60 0.20 25)", hint: COLOR_HINT },
  { key: "--chart-5", label: "Chart 5", group: "charts", input: "color", defaultValue: "oklch(0.55 0.22 285)", hint: COLOR_HINT },
]

/** Ordered color sub-sections for the Colors tab. */
export const COLOR_GROUPS: { id: string; label: string; hint?: string }[] = [
  { id: "surfaces", label: "Surfaces & text", hint: "Page, cards, popovers, muted surfaces, borders and inputs." },
  { id: "brand", label: "Brand", hint: "Primary, secondary, accent and the focus ring." },
  { id: "status", label: "Status & semantic", hint: "Success, warning, destructive, info and premium — each with its foreground." },
  { id: "sidebar", label: "Sidebar", hint: "The app navigation rail surface and its accents." },
  { id: "charts", label: "Charts", hint: "The five-colour palette dashboard charts cycle through." },
]

/* ============================================================================
   SHAPE & SIZE  (sliders / selects / text)
   ============================================================================ */

const RADIUS_PICKS = [
  { label: "Sharp", value: "0rem" },
  { label: "0.25", value: "0.25rem" },
  { label: "0.5", value: "0.5rem" },
  { label: "0.75", value: "0.75rem" },
  { label: "1rem", value: "1rem" },
  { label: "Pill", value: "9999px" },
]

export const SHAPE_TOKENS: TokenSpec[] = [
  {
    key: "--radius",
    label: "Base radius",
    group: "radius",
    input: "slider",
    defaultValue: "0.5rem",
    unit: "rem",
    min: 0,
    max: 1.5,
    step: 0.025,
    hint: "--radius-sm / -md / -lg / -xl / -2xl derive from this automatically.",
    picks: RADIUS_PICKS,
  },
]

export const LAYOUT_TOKENS: TokenSpec[] = [
  { key: "--spacing-unit", label: "Spacing unit", group: "layout", input: "slider", defaultValue: "1rem", unit: "rem", min: 0.5, max: 2, step: 0.05, hint: "Base layout rhythm." },
  { key: "--header-height", label: "Header height", group: "layout", input: "slider", defaultValue: "4rem", unit: "rem", min: 2.5, max: 6, step: 0.25 },
  { key: "--sidebar-width", label: "Sidebar width", group: "layout", input: "slider", defaultValue: "16rem", unit: "rem", min: 12, max: 24, step: 0.5 },
  { key: "--sidebar-collapsed-width", label: "Sidebar collapsed width", group: "layout", input: "slider", defaultValue: "4rem", unit: "rem", min: 3, max: 6, step: 0.25 },
  { key: "--max-content-width", label: "Max content width", group: "layout", input: "slider", defaultValue: "80rem", unit: "rem", min: 60, max: 120, step: 1 },
  { key: "--footer-height", label: "Footer height", group: "layout", input: "slider", defaultValue: "4rem", unit: "rem", min: 2.5, max: 6, step: 0.25 },
  {
    key: "--font-scale",
    label: "Font scale",
    group: "layout",
    input: "slider",
    defaultValue: "1",
    unit: "",
    min: 0.8,
    max: 1.3,
    step: 0.01,
    hint: "Global multiplier on the type scale.",
    picks: [
      { label: "Compact", value: "0.9" },
      { label: "Default", value: "1" },
      { label: "Comfortable", value: "1.1" },
      { label: "Large", value: "1.2" },
    ],
  },
]

/* ============================================================================
   COMPONENTS  (sliders / selects / text)
   ============================================================================ */

const WEIGHT_OPTIONS = [
  { label: "Regular (400)", value: "400" },
  { label: "Medium (500)", value: "500" },
  { label: "Semibold (600)", value: "600" },
  { label: "Bold (700)", value: "700" },
]

export const COMPONENT_TOKENS: TokenSpec[] = [
  // Button
  { key: "--button-radius", label: "Button radius", group: "button", input: "slider", defaultValue: "0.5rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--button-padding-x", label: "Button padding X", group: "button", input: "slider", defaultValue: "1rem", unit: "rem", min: 0.25, max: 2, step: 0.05 },
  { key: "--button-padding-y", label: "Button padding Y", group: "button", input: "slider", defaultValue: "0.5rem", unit: "rem", min: 0.125, max: 1.25, step: 0.025 },
  { key: "--button-font-size", label: "Button font size", group: "button", input: "slider", defaultValue: "0.875rem", unit: "rem", min: 0.7, max: 1.25, step: 0.025 },
  { key: "--button-font-weight", label: "Button font weight", group: "button", input: "select", defaultValue: "500", options: WEIGHT_OPTIONS },

  // Input
  { key: "--input-radius", label: "Input radius", group: "input", input: "slider", defaultValue: "0.5rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--input-padding-x", label: "Input padding X", group: "input", input: "slider", defaultValue: "0.75rem", unit: "rem", min: 0.25, max: 1.5, step: 0.025 },
  { key: "--input-height", label: "Input height", group: "input", input: "slider", defaultValue: "2.5rem", unit: "rem", min: 1.75, max: 3.5, step: 0.05 },
  { key: "--input-font-size", label: "Input font size", group: "input", input: "slider", defaultValue: "0.875rem", unit: "rem", min: 0.7, max: 1.25, step: 0.025 },
  { key: "--input-border-width", label: "Input border width", group: "input", input: "slider", defaultValue: "1px", unit: "px", min: 0, max: 3, step: 0.5 },

  // Card
  { key: "--card-radius", label: "Card radius", group: "card", input: "slider", defaultValue: "0.625rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--card-padding", label: "Card padding", group: "card", input: "slider", defaultValue: "1.25rem", unit: "rem", min: 0.5, max: 2.5, step: 0.05 },
  { key: "--card-border-width", label: "Card border width", group: "card", input: "slider", defaultValue: "1px", unit: "px", min: 0, max: 3, step: 0.5 },

  // Badge
  { key: "--badge-radius", label: "Badge radius", group: "badge", input: "slider", defaultValue: "0.375rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--badge-padding-x", label: "Badge padding X", group: "badge", input: "slider", defaultValue: "0.625rem", unit: "rem", min: 0.125, max: 1.25, step: 0.025 },
  { key: "--badge-font-size", label: "Badge font size", group: "badge", input: "slider", defaultValue: "0.75rem", unit: "rem", min: 0.6, max: 1, step: 0.025 },

  // Avatar
  { key: "--avatar-radius", label: "Avatar radius", group: "avatar", input: "text", defaultValue: "9999px", hint: "Use 9999px for a circle, or a rem value for a squircle." },
  { key: "--avatar-size", label: "Avatar size", group: "avatar", input: "slider", defaultValue: "2.5rem", unit: "rem", min: 1.5, max: 4, step: 0.05 },

  // Dialog
  { key: "--dialog-radius", label: "Dialog radius", group: "dialog", input: "slider", defaultValue: "0.625rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--dialog-padding", label: "Dialog padding", group: "dialog", input: "slider", defaultValue: "1.5rem", unit: "rem", min: 0.5, max: 3, step: 0.05 },
  { key: "--dialog-max-width", label: "Dialog max width", group: "dialog", input: "slider", defaultValue: "32rem", unit: "rem", min: 20, max: 56, step: 1 },

  // Tabs
  { key: "--tabs-radius", label: "Tabs radius", group: "tabs", input: "slider", defaultValue: "0.5rem", unit: "rem", min: 0, max: 1.5, step: 0.025, picks: RADIUS_PICKS },
  { key: "--tabs-padding", label: "Tabs padding", group: "tabs", input: "slider", defaultValue: "0.75rem", unit: "rem", min: 0.25, max: 1.5, step: 0.025 },
]

/** Ordered component sub-sections for the Components tab. */
export const COMPONENT_GROUPS: { id: string; label: string }[] = [
  { id: "button", label: "Buttons" },
  { id: "input", label: "Inputs" },
  { id: "card", label: "Cards" },
  { id: "badge", label: "Badges" },
  { id: "avatar", label: "Avatars" },
  { id: "dialog", label: "Dialogs" },
  { id: "tabs", label: "Tabs" },
]

/* ============================================================================
   EFFECTS  (sliders)
   ============================================================================ */

export const EFFECT_TOKENS: TokenSpec[] = [
  {
    key: "--glass-intensity",
    label: "Glass blur intensity",
    group: "effects",
    input: "slider",
    defaultValue: "0.12",
    unit: "",
    min: 0,
    max: 0.3,
    step: 0.005,
    hint: "Backdrop blur on sticky/floating layers (× 100px).",
    picks: [
      { label: "Off", value: "0" },
      { label: "Subtle", value: "0.08" },
      { label: "Default", value: "0.12" },
      { label: "Heavy", value: "0.24" },
    ],
  },
  {
    key: "--shadow-strength",
    label: "Shadow strength",
    group: "effects",
    input: "slider",
    defaultValue: "0.05",
    unit: "",
    min: 0,
    max: 0.3,
    step: 0.005,
    hint: "Elevation opacity across cards and overlays.",
    picks: [
      { label: "Off", value: "0" },
      { label: "Soft", value: "0.05" },
      { label: "Medium", value: "0.12" },
      { label: "Strong", value: "0.22" },
    ],
  },
  {
    key: "--anim-duration-scale",
    label: "Animation speed",
    group: "effects",
    input: "slider",
    defaultValue: "1",
    unit: "",
    min: 0,
    max: 2,
    step: 0.05,
    hint: "Multiplier on transition durations (0 = instant, 2 = slow).",
    picks: [
      { label: "Instant", value: "0" },
      { label: "Fast", value: "0.5" },
      { label: "Default", value: "1" },
      { label: "Slow", value: "1.5" },
    ],
  },
]

/* ============================================================================
   TYPOGRAPHY  (slider + text; the font picker covers --font-sans/--font-arabic)
   ============================================================================ */

export const TYPOGRAPHY_TOKENS: TokenSpec[] = [
  {
    key: "--font-size-base",
    label: "Base font size",
    group: "typography",
    input: "slider",
    defaultValue: "1rem",
    unit: "rem",
    min: 0.8,
    max: 1.25,
    step: 0.0125,
    hint: "Anchors the whole type scale.",
    picks: [
      { label: "0.9", value: "0.9rem" },
      { label: "1rem", value: "1rem" },
      { label: "1.05", value: "1.05rem" },
      { label: "1.1", value: "1.1rem" },
    ],
  },
  {
    key: "--font-mono",
    label: "Monospace font stack",
    group: "typography",
    input: "text",
    defaultValue: "ui-monospace, monospace",
    hint: "Used for code, IDs and tabular numbers.",
  },
]

/* ============================================================================
   AGGREGATE INDEX
   ============================================================================ */

/** Every spec across every group — useful for effective-value lookups. */
export const ALL_TOKEN_SPECS: TokenSpec[] = [
  ...COLOR_TOKENS,
  ...SHAPE_TOKENS,
  ...LAYOUT_TOKENS,
  ...COMPONENT_TOKENS,
  ...EFFECT_TOKENS,
  ...TYPOGRAPHY_TOKENS,
]

/** Fast spec lookup by token key. */
export const SPEC_BY_KEY: Map<string, TokenSpec> = new Map(ALL_TOKEN_SPECS.map(s => [s.key, s]))

/** Built-in default value for a token key (from globals.css light `:root`). */
export function defaultValueFor(key: string): string {
  return SPEC_BY_KEY.get(key)?.defaultValue ?? ""
}

/* ============================================================================
   TEMPLATE GALLERY — complete, coherent theme palettes
   ============================================================================ */

export interface ThemeTemplate {
  id: string
  name: string
  /** Short tagline shown under the name. */
  description: string
  /** Full coherent palette merged into the draft on apply. */
  tokens: Record<string, string>
}

/**
 * Build a coherent light-mode palette from a small set of brand/status hues.
 * Keeps every template tasteful and AA-ish without hand-tuning 12 values each.
 */
function template(
  id: string,
  name: string,
  description: string,
  parts: {
    primary: string
    accent: string
    ring?: string
    secondary?: string
    secondaryFg?: string
    success?: string
    warning?: string
    destructive?: string
    info?: string
    premium?: string
    background?: string
    foreground?: string
    card?: string
    border?: string
    chart?: [string, string, string, string, string]
  },
): ThemeTemplate {
  const tokens: Record<string, string> = {
    "--primary": parts.primary,
    "--primary-foreground": "oklch(0.99 0.002 240)",
    "--accent": parts.accent,
    "--accent-foreground": "oklch(0.99 0.002 240)",
    "--ring": parts.ring ?? parts.primary,
    "--secondary": parts.secondary ?? "oklch(0.94 0.012 240)",
    "--secondary-foreground": parts.secondaryFg ?? "oklch(0.25 0.02 240)",
    "--success": parts.success ?? "oklch(0.58 0.16 150)",
    "--warning": parts.warning ?? "oklch(0.72 0.16 70)",
    "--destructive": parts.destructive ?? "oklch(0.55 0.22 25)",
    "--info": parts.info ?? "oklch(0.58 0.14 245)",
    "--premium": parts.premium ?? "oklch(0.55 0.22 285)",
    "--background": parts.background ?? "oklch(0.985 0.003 240)",
    "--foreground": parts.foreground ?? "oklch(0.20 0.015 240)",
    "--card": parts.card ?? "oklch(1 0 0)",
    "--border": parts.border ?? "oklch(0.91 0.008 240)",
    "--sidebar-primary": parts.primary,
    "--sidebar-ring": parts.ring ?? parts.primary,
  }
  if (parts.chart) {
    parts.chart.forEach((c, i) => {
      tokens[`--chart-${i + 1}`] = c
    })
  }
  return { id, name, description, tokens }
}

export const THEME_TEMPLATES: ThemeTemplate[] = [
  template("acme-blue", "Acme Blue", "The default cool, professional blue-teal.", {
    primary: "oklch(0.52 0.14 220)",
    accent: "oklch(0.65 0.15 200)",
    secondary: "oklch(0.94 0.012 220)",
    secondaryFg: "oklch(0.25 0.02 220)",
    chart: ["oklch(0.55 0.14 220)", "oklch(0.66 0.15 165)", "oklch(0.70 0.16 70)", "oklch(0.60 0.20 25)", "oklch(0.55 0.22 285)"],
  }),
  template("midnight-indigo", "Midnight Indigo", "Deep violet-blue for a focused, modern feel.", {
    primary: "oklch(0.50 0.20 275)",
    accent: "oklch(0.62 0.18 285)",
    ring: "oklch(0.50 0.20 275)",
    secondary: "oklch(0.93 0.02 280)",
    secondaryFg: "oklch(0.28 0.04 280)",
    info: "oklch(0.56 0.16 270)",
    chart: ["oklch(0.52 0.20 275)", "oklch(0.62 0.18 300)", "oklch(0.66 0.15 220)", "oklch(0.70 0.14 165)", "oklch(0.66 0.18 25)"],
  }),
  template("ocean-teal", "Ocean Teal", "Calm blue-green, crisp and maritime.", {
    primary: "oklch(0.58 0.12 195)",
    accent: "oklch(0.68 0.13 190)",
    ring: "oklch(0.58 0.12 195)",
    secondary: "oklch(0.93 0.018 195)",
    secondaryFg: "oklch(0.27 0.03 195)",
    chart: ["oklch(0.58 0.12 195)", "oklch(0.66 0.14 210)", "oklch(0.70 0.13 165)", "oklch(0.72 0.14 110)", "oklch(0.60 0.16 250)"],
  }),
  template("emerald", "Emerald", "Fresh green that reads as success-forward.", {
    primary: "oklch(0.56 0.15 155)",
    accent: "oklch(0.68 0.15 165)",
    ring: "oklch(0.56 0.15 155)",
    secondary: "oklch(0.93 0.02 155)",
    secondaryFg: "oklch(0.27 0.035 155)",
    success: "oklch(0.56 0.16 150)",
    chart: ["oklch(0.56 0.15 155)", "oklch(0.66 0.15 130)", "oklch(0.70 0.14 95)", "oklch(0.62 0.14 185)", "oklch(0.60 0.18 25)"],
  }),
  template("royal-violet", "Royal Violet", "Vivid purple for a bold, creative dashboard.", {
    primary: "oklch(0.55 0.24 300)",
    accent: "oklch(0.66 0.20 310)",
    ring: "oklch(0.55 0.24 300)",
    secondary: "oklch(0.94 0.025 300)",
    secondaryFg: "oklch(0.28 0.05 300)",
    premium: "oklch(0.58 0.24 320)",
    chart: ["oklch(0.55 0.24 300)", "oklch(0.66 0.20 330)", "oklch(0.62 0.18 270)", "oklch(0.68 0.15 200)", "oklch(0.66 0.16 90)"],
  }),
  template("sunset-amber", "Sunset Amber", "Warm gold accent for a confident, premium look.", {
    primary: "oklch(0.64 0.16 65)",
    accent: "oklch(0.72 0.15 50)",
    ring: "oklch(0.64 0.16 65)",
    secondary: "oklch(0.94 0.025 70)",
    secondaryFg: "oklch(0.30 0.04 60)",
    warning: "oklch(0.74 0.15 75)",
    chart: ["oklch(0.64 0.16 65)", "oklch(0.70 0.16 40)", "oklch(0.62 0.18 25)", "oklch(0.72 0.14 110)", "oklch(0.60 0.16 285)"],
  }),
  template("graphite", "Graphite", "Neutral, near-monochrome — content leads, brand whispers.", {
    primary: "oklch(0.38 0.01 250)",
    accent: "oklch(0.55 0.015 250)",
    ring: "oklch(0.38 0.01 250)",
    secondary: "oklch(0.93 0.004 250)",
    secondaryFg: "oklch(0.28 0.008 250)",
    chart: ["oklch(0.40 0.01 250)", "oklch(0.55 0.012 250)", "oklch(0.68 0.012 250)", "oklch(0.58 0.10 220)", "oklch(0.60 0.14 25)"],
  }),
  template("rose", "Rose", "Warm pink-red for a friendly, energetic tone.", {
    primary: "oklch(0.58 0.20 12)",
    accent: "oklch(0.68 0.17 20)",
    ring: "oklch(0.58 0.20 12)",
    secondary: "oklch(0.94 0.025 12)",
    secondaryFg: "oklch(0.30 0.05 12)",
    chart: ["oklch(0.58 0.20 12)", "oklch(0.68 0.17 35)", "oklch(0.62 0.18 340)", "oklch(0.68 0.13 70)", "oklch(0.58 0.16 250)"],
  }),
  template("forest-green", "Forest Green", "Deep, earthy green for a grounded, natural feel.", {
    primary: "oklch(0.48 0.12 145)",
    accent: "oklch(0.58 0.13 130)",
    ring: "oklch(0.48 0.12 145)",
    secondary: "oklch(0.92 0.018 145)",
    secondaryFg: "oklch(0.26 0.03 145)",
    background: "oklch(0.985 0.004 145)",
    chart: ["oklch(0.48 0.12 145)", "oklch(0.58 0.13 110)", "oklch(0.66 0.13 80)", "oklch(0.55 0.12 185)", "oklch(0.58 0.16 40)"],
  }),
  template("high-contrast", "High Contrast", "Maximum legibility — black brand on pure white.", {
    primary: "oklch(0.22 0.01 250)",
    accent: "oklch(0.45 0.18 250)",
    ring: "oklch(0.45 0.18 250)",
    secondary: "oklch(0.92 0 0)",
    secondaryFg: "oklch(0.15 0 0)",
    background: "oklch(1 0 0)",
    foreground: "oklch(0.13 0.01 250)",
    card: "oklch(1 0 0)",
    border: "oklch(0.82 0.008 250)",
    success: "oklch(0.50 0.17 150)",
    warning: "oklch(0.62 0.18 70)",
    destructive: "oklch(0.50 0.24 25)",
    info: "oklch(0.48 0.18 250)",
    chart: ["oklch(0.22 0.01 250)", "oklch(0.48 0.18 250)", "oklch(0.50 0.17 150)", "oklch(0.62 0.18 70)", "oklch(0.50 0.24 25)"],
  }),
]

/** A handful of swatch keys to render as a template card's mini preview. */
export const TEMPLATE_PREVIEW_KEYS = [
  "--primary",
  "--accent",
  "--success",
  "--destructive",
  "--background",
  "--card",
] as const
