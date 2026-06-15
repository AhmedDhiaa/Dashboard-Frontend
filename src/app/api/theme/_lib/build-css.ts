/**
 * Convert a `Record<string, string>` of CSS custom properties into a
 * `:root { ... }` block safe to inject into a server-rendered <style> tag.
 *
 * Keys must look like `--my-var` (custom-property syntax). Values are
 * rejected if they contain characters that could escape the declaration
 * (`}`, `<`, `>`, `\`, newlines) — admins shouldn't be able to inject HTML
 * or close the <style> tag through the override store.
 *
 * Returns an empty string if there are no valid tokens, so the layout
 * can skip rendering the <style> entirely.
 */

const KEY_RE = /^--[a-zA-Z0-9-]+$/
const FORBIDDEN_VALUE_CHARS = /[}\\<>\n\r]/

export function buildThemeCss(tokens: Record<string, string>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(tokens)) {
    if (!KEY_RE.test(key)) continue
    if (typeof value !== "string" || FORBIDDEN_VALUE_CHARS.test(value)) continue
    lines.push(`  ${key}: ${value};`)
  }
  if (lines.length === 0) return ""
  return `:root {\n${lines.join("\n")}\n}\n`
}
