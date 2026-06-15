/**
 * Design System Utility Functions
 * Helper functions for applying consistent styles
 */

/**
 * Common style getters for quick access
 */
export const styles = {
  // Page containers
  page: "min-h-screen bg-background",
  pageContent: "container mx-auto px-4 py-6",

  // Cards
  card: "rounded-lg border bg-card text-card-foreground shadow-sm",
  cardAccent: "rounded-lg border-2 border-primary bg-card text-card-foreground shadow-md",

  // Inputs
  input: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  inputError: "flex h-10 w-full rounded-md border-2 border-destructive bg-background px-3 py-2 text-sm",

  // Text
  textPrimary: "text-foreground",
  textSecondary: "text-muted-foreground",
  textMuted: "text-muted-foreground/60",
  textAccent: "text-primary",

  // Backgrounds
  bgMain: "bg-background",
  bgCard: "bg-card",
  bgSecondary: "bg-secondary",
  bgInput: "bg-input",

  // Forms
  formItem: "space-y-2",
  formLabel: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  formInput: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",

  // Grids
  grid2: "grid grid-cols-1 gap-4 md:grid-cols-2",
  grid3: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
  grid4: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",

  // Section headers
  sectionTitle: "text-xl font-semibold",
  sectionCard: "rounded-lg border bg-card p-6",
  sectionCardAccent: "rounded-lg border-2 border-primary bg-card p-6",

  // Item displays
  itemCard: "flex items-center justify-between rounded-md border p-4",
  itemLabel: "text-sm font-medium text-muted-foreground",
  itemValue: "text-base font-semibold",
}
