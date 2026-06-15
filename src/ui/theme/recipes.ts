/**
 * COMPONENT RECIPES
 *
 * Variant/part class maps for components whose ENTIRE styling lives in the
 * theme layer (i.e. they have no primitive of their own).
 *
 * NOTE: the core primitives (button/card/input/badge/select/…) own their base
 * classes inline (CVA or className). They must NOT also have a recipe here —
 * `cn` is tailwind-merge, so a recipe's classes (applied AFTER the primitive's
 * own via `resolveStyles().root`) would silently OVERRIDE the primitive's
 * intended design. Those recipes were removed; the resolver's no-recipe path
 * still applies the user's per-part class overrides from the ThemeCustomizer.
 */

export interface ComponentRecipe {
  base: string
  variants?: Record<string, Record<string, string>>
  sizes?: Record<string, Record<string, string>>
  parts: Record<string, string>
}

export const recipes: Record<string, ComponentRecipe> = {
  // CRUD ACTIONS — theme-only components (no dedicated primitive).
  "crud-add": {
    base: "inline-flex items-center justify-center rounded-md font-medium transition-all shadow-sm",
    variants: {
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    parts: {
      root: "bg-primary text-primary-foreground hover:bg-primary/90",
      icon: "me-2 h-4 w-4",
    },
  },
  "crud-edit": {
    base: "inline-flex items-center justify-center rounded-md font-medium transition-all",
    parts: {
      root: "text-info hover:bg-info/10 p-2",
      icon: "h-4 w-4",
    },
  },
  "crud-delete": {
    base: "inline-flex items-center justify-center rounded-md font-medium transition-all",
    parts: {
      root: "text-destructive hover:bg-destructive/10 p-2",
      icon: "h-4 w-4",
    },
  },
  "crud-view": {
    base: "inline-flex items-center justify-center rounded-md font-medium transition-all",
    parts: {
      root: "text-muted-foreground hover:bg-muted/10 p-2",
      icon: "h-4 w-4",
    },
  },
}
