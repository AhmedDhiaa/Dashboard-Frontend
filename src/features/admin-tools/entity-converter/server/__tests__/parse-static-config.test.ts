/**
 * Refusal-rule coverage for parse-static-config.
 *
 * Each rule from the spec gets a synthetic minimal fixture so the
 * refusal-or-pass decision can be asserted independently of the real
 * src/domains/ tree. The end-to-end report (against the actual configs)
 * is exercised by `static-entity-convertibility.test.ts`.
 */

import { describe, it, expect } from "vitest"
import { parseStaticConfigFromSource } from "../parse-static-config"

function wrap(body: string): string {
  return `import { Tag } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
export const fooConfig: EntityConfig = {
  entityName: "foo",
  singularName: "Foo",
  pluralName: "Foos",
  icon: Tag,
  permissionKey: "Api.Foo",
${body}
}
`
}

const MINIMAL_FORM_FIELDS = `  formFields: {
    name: { type: "text", labelKey: "pages.name", required: true },
  },`

describe("parseStaticConfigFromSource — happy paths", () => {
  it("accepts a minimal inline config", () => {
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(MINIMAL_FORM_FIELDS))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entity.id).toBe("foo")
    expect(result.entity.fields).toHaveLength(1)
    expect(result.entity.fields[0]!.type).toBe("text")
    expect(result.entity.permissionKey).toBe("Api.Foo")
    expect(result.entity.icon).toBe("Tag")
  })

  it("maps EntityConfigFieldType → RuntimeFieldType correctly", () => {
    const fields = `  formFields: {
    a: { type: "text", labelKey: "x" },
    b: { type: "textarea", labelKey: "x" },
    c: { type: "number", labelKey: "x" },
    d: { type: "boolean", labelKey: "x" },
    e: { type: "date", labelKey: "x" },
    f: { type: "datetime", labelKey: "x" },
    g: { type: "select", labelKey: "x", options: [{ value: "1", label: "One" }] },
    h: { type: "file", labelKey: "x" },
    i: { type: "email", labelKey: "x" },
    j: { type: "autocomplete", labelKey: "x", entityName: "bar", displayField: "name" },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entity.fields.map(f => f.type)).toEqual([
      "text",
      "textarea",
      "number",
      "boolean",
      "date",
      "datetime",
      "select",
      "file",
      "email",
      "entity-autocomplete",
    ])
  })

  it("skips hidden fields rather than refusing", () => {
    const fields = `  formFields: {
    name: { type: "text", labelKey: "pages.name" },
    stamp: { type: "text", hidden: true },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entity.fields.map(f => f.key)).toEqual(["name"])
  })
})

describe("parseStaticConfigFromSource — refusals", () => {
  it("refuses when listColumns is an Identifier", () => {
    const body = `  listColumns: externalColumns,
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/external renderers.*listColumns/)
  })

  it("refuses when formFields is an Identifier", () => {
    const body = `  formFields: externalFormFields,`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/external renderers.*formFields/)
  })

  it("tolerates plain `condition` predicates in detailSections (display-gate, no JSX)", () => {
    const body = `  detailSections: [
    { title: "primary", fields: [{ name: "n", condition: entity => !!entity.n }] },
  ],
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(true)
  })

  it("refuses when detailSections contains JSX", () => {
    const body = `  detailSections: [
    { title: "primary", fields: [{ name: "n", render: () => <span>x</span> }] },
  ],
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/detailSections contains custom render logic/)
  })

  it("refuses when detailSections is an Identifier", () => {
    const body = `  detailSections: externalDetailSections,
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/external renderers.*detailSections/)
  })

  it("refuses when a form field uses condition", () => {
    const fields = `  formFields: {
    name: { type: "text", labelKey: "x", condition: values => !!values.x },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/conditional rendering/)
  })

  it("refuses when a form field uses customRender", () => {
    const fields = `  formFields: {
    name: { type: "text", labelKey: "x", customRender: () => null },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/custom render hooks/)
  })

  it("refuses unsupported field types (enum, custom, password)", () => {
    for (const bad of ["enum", "custom", "password"]) {
      const fields = `  formFields: {
    name: { type: "${bad}", labelKey: "x" },
  },`
      const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.reason).toMatch(new RegExp(`unsupported type "${bad}"`))
    }
  })

  it("refuses unknown field type tokens", () => {
    const fields = `  formFields: {
    name: { type: "spaceship", labelKey: "x" },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/unknown type "spaceship"/)
  })

  it("refuses entityToFormData that is not a plain arrow", () => {
    const body = `  entityToFormData: someExternalFn,
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/entityToFormData is not a simple arrow/)
  })

  it("refuses entityToFormData whose body is not an object literal", () => {
    const body = `  entityToFormData: (e) => doStuff(e),
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/entityToFormData body is not a plain object literal/)
  })

  it("refuses defaultFormValues with non-literal cast", () => {
    const body = `  defaultFormValues: getDefaults() as Partial<Foo>,
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/defaultFormValues uses a non-literal `as` cast/)
  })

  it("refuses select with non-literal options", () => {
    const fields = `  formFields: {
    status: { type: "select", labelKey: "x", options: STATUS_OPTIONS },
  },`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(fields))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/options is not an inline array/)
  })

  it("refuses when no exported config literal is found", () => {
    const source = `import { x } from "y"
export const notAConfig = 42
`
    const result = parseStaticConfigFromSource("foo.config.tsx", source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/No exported config object literal found/)
  })

  it("refuses formLayout that contains JSX render hooks", () => {
    const body = `  formLayout: { type: "sections", sections: [ { fields: [], render: () => <span>x</span> } ] },
${MINIMAL_FORM_FIELDS}`
    const result = parseStaticConfigFromSource("foo.config.tsx", wrap(body))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/formLayout contains custom render logic/)
  })
})
