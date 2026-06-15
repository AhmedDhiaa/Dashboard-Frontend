/**
 * OpenAPI property → Page Builder field mapper (per spec §5).
 *
 * The mapping has two passes:
 *   1. **Format-driven** — `format: "date"` → `date`, `"date-time"` →
 *      `datetime`, `"email"` → `email`, etc. Highest priority.
 *   2. **Type + heuristic-driven** — fall back to `type` (`boolean`,
 *      `integer`/`number`), then to a small set of name-based hints
 *      (`password`, `phone`, `description`, `color`, `lat`/`lng`).
 *
 * `enum` arrays produce a `select` field with the literal values as
 * options. `$ref` properties become `autocomplete` (the related entity
 * is resolved at the wizard level — page-generator picks the entity name
 * from the ref segment).
 */

import type { ParsedProperty } from "./parser"

export interface MappedField {
  name: string
  type: string
  label: { en: string; ar: string }
  required: boolean
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  options?: { value: string; label: { en: string; ar: string } }[]
  showInList: boolean
  showInDetail: boolean
  showInForm: boolean
}

export function mapSwaggerToField(prop: ParsedProperty): MappedField {
  const type = pickFieldType(prop)
  const label = humanize(prop.name)
  return {
    name: prop.name,
    type,
    label: { en: label, ar: label },
    required: prop.required,
    validation: hasValidation(prop)
      ? {
          min: prop.minimum,
          max: prop.maximum,
          minLength: prop.minLength,
          maxLength: prop.maxLength,
          pattern: prop.pattern,
        }
      : undefined,
    options: prop.enum
      ? prop.enum.map(v => {
          const value = String(v)
          return { value, label: { en: value, ar: value } }
        })
      : undefined,
    showInList: !["password", "textarea", "richtext", "json", "file", "image", "image-crop", "map-location"].includes(
      type,
    ),
    showInDetail: true,
    showInForm: true,
  }
}

function hasValidation(p: ParsedProperty): boolean {
  return (
    p.minimum !== undefined ||
    p.maximum !== undefined ||
    p.minLength !== undefined ||
    p.maxLength !== undefined ||
    p.pattern !== undefined
  )
}

function pickFieldType(prop: ParsedProperty): string {
  // 1. Format takes priority — RFC-defined semantics outrank naming.
  const fromFormat = mapByFormat(prop.format)
  if (fromFormat) return fromFormat

  // 2. Enum → select. (Even before type checks: a string "type" with an
  // `enum` constraint should still surface as a picker, not a free input.)
  if (prop.enum && prop.enum.length > 0) return "select"

  // 3. $ref → autocomplete (the referenced entity is resolved later).
  if (prop.ref) return "autocomplete"

  // 4. Primitive types.
  if (prop.type === "boolean") return "boolean"
  if (prop.type === "integer" || prop.type === "number") return "number"

  // 5. Name-based heuristics (last resort, for `type: string` mostly).
  return mapByName(prop.name) ?? "text"
}

function mapByFormat(format: string | undefined): string | undefined {
  switch (format) {
    case "date":
      return "date"
    case "date-time":
      return "datetime"
    case "time":
      return "time"
    case "email":
      return "email"
    case "uri":
    case "url":
      return "url"
    case "uuid":
      return "text"
    case "binary":
    case "byte":
      return "file"
    case "password":
      return "password"
    default:
      return undefined
  }
}

function mapByName(name: string): string | undefined {
  if (/password/i.test(name)) return "password"
  if (/phone|mobile|tel\b/i.test(name)) return "phone"
  if (/description|notes?|comment|remark/i.test(name)) return "textarea"
  if (/color/i.test(name)) return "color"
  if (/(latitude|longitude|location|coordinates?)/i.test(name)) return "map-location"
  if (/email/i.test(name)) return "email"
  if (/url|website|link/i.test(name)) return "url"
  if (/image|photo|picture|avatar/i.test(name)) return "image"
  return undefined
}

/**
 * Turn a camelCase / snake_case identifier into a human label.
 * "phoneInfo" → "Phone Info". Used as a fallback for the localized label
 * — the admin can edit either side of `{en, ar}` later.
 */
export function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}
