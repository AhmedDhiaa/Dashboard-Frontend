/**
 * Pure helpers that derive code-gen paths and identifiers from the
 * entity name + domain. Deterministic, side-effect-free — re-used by
 * the codegen pipeline, the materialize endpoint, and the runtime
 * builder's mapper.
 *
 * Originally lived under `wizard/derivations.ts` when the 7-step wizard
 * was the primary entity-creation UI. The wizard was retired in favour
 * of the `/builder` runtime UI; these helpers stay because the codegen
 * pipeline still needs them.
 */

const PLURAL_RULES: Array<[RegExp, string]> = [
  [/(s|x|z|ch|sh)$/i, "$1es"],
  [/([^aeiou])y$/i, "$1ies"],
  [/(.)$/, "$1s"],
]

export function pluralizeEnglish(singular: string): string {
  if (!singular) return ""
  for (const [pattern, replacement] of PLURAL_RULES) {
    if (pattern.test(singular)) return singular.replace(pattern, replacement)
  }
  return singular
}

export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
}

export function toPascalCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("")
}

/** Default API endpoint for an entity (matches the existing ABP convention). */
export function deriveEndpoint(entityName: string): string {
  const slug = toKebabCase(entityName)
  return slug ? `/api/app/${slug}` : ""
}

/** Default ABP permission key (e.g. "Api.Customer"). */
export function derivePermissionKey(entityName: string): string {
  const pascal = toPascalCase(entityName)
  return pascal ? `Api.${pascal}` : ""
}

// `deriveFilePath` and `deriveRoutePath` lived here when the wizard's live
// preview pane needed them. The wizard is gone (Task A3) and no other
// caller references them — drop them rather than carry them as dead code.
