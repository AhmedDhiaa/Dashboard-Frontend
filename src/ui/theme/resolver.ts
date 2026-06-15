import { cn } from "@/shared/utils"
import { recipes, type ComponentRecipe } from "./recipes"

/**
 * STYLE RESOLVER
 *
 * The core engine that resolves component styles based on theme tokens,
 * recipes, and user overrides.
 *
 * flow: Theme Tokens (CSS Variables) -> Recipes -> Overrides -> Class Names
 */

export interface ResolveOptions {
  variant?: string
  size?: string
  className?: string
  [key: string]: string | number | boolean | undefined
}

export interface ResolvedStyles {
  [part: string]: string
}

/**
 * Resolves styles for a specific component and its parts.
 */
export function resolveStyles(
  componentKey: string,
  options: ResolveOptions = {},
  overrides: Record<string, { styles?: Record<string, string | number>; classes?: string[] }> = {},
): ResolvedStyles {
  const recipe: ComponentRecipe | undefined = recipes[componentKey]

  // No recipe: the primitive owns its base classes (CVA / inline className).
  // We still apply the user's per-part CLASS overrides from the Components tab
  // (e.g. "shadow-md" on the input root) so the customizer works for every
  // primitive, not only the few with a recipe. Per-part STYLE overrides are
  // applied separately as CSS vars via resolveInlineStyles.
  if (!recipe) {
    const result: ResolvedStyles = {}
    Object.entries(overrides).forEach(([part, data]) => {
      result[part] = cn(data?.classes?.join(" "), part === "root" ? options.className : undefined)
    })
    if (result.root === undefined) result.root = options.className || ""
    return result
  }

  const result: ResolvedStyles = {}

  // 1. Process variants and sizes from recipe base
  let rootClasses = recipe.base

  if (recipe.variants) {
    Object.entries(recipe.variants).forEach(([type, values]) => {
      const val = options[type]
      const optionValue = typeof val === "string" ? val : "default"
      if (values[optionValue]) {
        rootClasses = cn(rootClasses, values[optionValue])
      }
    })
  }

  // 2. Process each part defined in the recipe
  Object.keys(recipe.parts).forEach(part => {
    const partRecipe = recipe.parts[part]
    const partOverrides = overrides[part] || {}

    // Merge part classes
    result[part] = cn(
      part === "root" ? rootClasses : partRecipe,
      partOverrides.classes?.join(" "),
      part === "root" ? options.className : "",
    )
  })

  return result
}

/**
 * Helper to generate CSS variable overrides for inline styles.
 */
export function resolveInlineStyles(
  componentId: string,
  overrides: Record<string, { styles?: Record<string, string | number> }> = {},
): React.CSSProperties {
  const cssStyles: Record<string, string | number> = {}

  Object.entries(overrides).forEach(([part, data]) => {
    if (data.styles) {
      Object.entries(data.styles).forEach(([prop, value]) => {
        // Generate CSS variable: --comp-part-prop
        const cssVar = `--${componentId}-${part}-${prop.replace(/([A-Z])/g, "-$1").toLowerCase()}`
        cssStyles[cssVar] = typeof value === "number" ? `${value}rem` : value
      })
    }
  })

  return cssStyles as React.CSSProperties
}
