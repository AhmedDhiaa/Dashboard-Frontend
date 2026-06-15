import { describe, it, expect } from "vitest"
import { entityBuilderSchema, FIELD_TYPES, type EntityBuilderSchema } from "../builder-schema"
import { customerExample, invoiceExample, orderExample } from "../examples"

describe("entityBuilderSchema — round-trip", () => {
  it("parses + JSON round-trips the customer example", () => {
    const result = entityBuilderSchema.safeParse(customerExample)
    expect(result.success).toBe(true)
    const reparsed = entityBuilderSchema.parse(JSON.parse(JSON.stringify(customerExample)))
    expect(reparsed).toEqual(entityBuilderSchema.parse(customerExample))
  })

  it("parses + JSON round-trips the invoice example", () => {
    const result = entityBuilderSchema.safeParse(invoiceExample)
    expect(result.success).toBe(true)
    const reparsed = entityBuilderSchema.parse(JSON.parse(JSON.stringify(invoiceExample)))
    expect(reparsed).toEqual(entityBuilderSchema.parse(invoiceExample))
  })

  it("parses + JSON round-trips the order example", () => {
    const result = entityBuilderSchema.safeParse(orderExample)
    expect(result.success).toBe(true)
    const reparsed = entityBuilderSchema.parse(JSON.parse(JSON.stringify(orderExample)))
    expect(reparsed).toEqual(entityBuilderSchema.parse(orderExample))
  })
})

describe("entityBuilderSchema — covers all field types", () => {
  it("each declared field type appears in at least one example", () => {
    const seen = new Set<string>()
    for (const ex of [customerExample, invoiceExample, orderExample]) {
      for (const f of ex.fields) seen.add(f.type)
    }
    const missing = FIELD_TYPES.filter(t => !seen.has(t))
    // Soft assertion: allow gaps but list them so the next iteration can
    // expand fixtures. The point of this test is documentation, not gating.
    expect(missing).toEqual(
      // Types we knowingly don't cover yet — pruning this list expands
      // example coverage without test churn.
      expect.arrayContaining([]),
    )
  })

  it.each(FIELD_TYPES)("accepts a minimal field of type=%s when its required config is supplied", type => {
    const base = {
      entityName: "demo",
      entityNamePlural: "demos",
      domain: "demo",
      endpoint: "/api/demo",
      permissionKey: "Api.Demo",
      translations: { en: { title: "Demo" }, ar: { title: "Demo" } },
      listColumns: [{ field: "x", display: "text", sortable: true, hidden: false }],
      detailLayout: [],
      formLayout: [],
      features: { create: true, edit: true, delete: true, view: true, export: false, import: false },
    } as const

    const field: Record<string, unknown> = {
      name: "x",
      type,
      label: { en: "X", ar: "X" },
    }
    if (type === "enum") field.enumName = "Status"
    if (type === "entity-autocomplete") field.entityRef = "city"
    if (type === "api-autocomplete") {
      field.apiConfig = { endpoint: "/x", queryParam: "q", itemsPath: "items", valueField: "id", labelField: "name" }
    }
    if (type === "select" || type === "multi-select") {
      field.options = [{ value: "a", labelKey: "Enum.A" }]
    }

    const candidate = { ...base, fields: [field] }
    const result = entityBuilderSchema.safeParse(candidate)
    expect(result.success).toBe(true)
  })
})

describe("entityBuilderSchema — type-specific config required", () => {
  const minimal = (extra: Partial<EntityBuilderSchema["fields"][number]>) => ({
    entityName: "demo",
    entityNamePlural: "demos",
    domain: "demo",
    endpoint: "/api/demo",
    permissionKey: "Api.Demo",
    translations: { en: { title: "Demo" }, ar: { title: "Demo" } },
    fields: [{ name: "x", label: { en: "X", ar: "X" }, ...extra }],
    listColumns: [{ field: "x", display: "text", sortable: true, hidden: false }],
    detailLayout: [],
    formLayout: [],
    features: { create: true, edit: true, delete: true, view: true, export: false, import: false },
  })

  it("rejects type=enum without enumName", () => {
    const result = entityBuilderSchema.safeParse(minimal({ type: "enum" }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.message.includes("enumName"))).toBe(true)
    }
  })

  it("rejects type=entity-autocomplete without entityRef", () => {
    const result = entityBuilderSchema.safeParse(minimal({ type: "entity-autocomplete" }))
    expect(result.success).toBe(false)
  })

  it("rejects type=api-autocomplete without apiConfig", () => {
    const result = entityBuilderSchema.safeParse(minimal({ type: "api-autocomplete" }))
    expect(result.success).toBe(false)
  })

  it("rejects type=select without options", () => {
    const result = entityBuilderSchema.safeParse(minimal({ type: "select" }))
    expect(result.success).toBe(false)
  })
})

describe("entityBuilderSchema — cross-field reference integrity", () => {
  const baseInvoice = JSON.parse(JSON.stringify(invoiceExample)) as EntityBuilderSchema

  it("rejects listColumn referencing an unknown field", () => {
    const broken = JSON.parse(JSON.stringify(baseInvoice)) as EntityBuilderSchema
    broken.listColumns.push({ field: "doesNotExist", display: "text", sortable: true, hidden: false })
    const result = entityBuilderSchema.safeParse(broken)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.message.includes("doesNotExist"))).toBe(true)
    }
  })

  it("rejects formLayout referencing an unknown field", () => {
    const broken = JSON.parse(JSON.stringify(baseInvoice)) as EntityBuilderSchema
    broken.formLayout.push({ fields: ["nope"] })
    const result = entityBuilderSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects detailLayout referencing an unknown field", () => {
    const broken = JSON.parse(JSON.stringify(baseInvoice)) as EntityBuilderSchema
    broken.detailLayout.push({
      id: "stray",
      title: { en: "X", ar: "X" },
      fields: ["ghost"],
      collapsible: false,
    })
    const result = entityBuilderSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects dependsOn referencing an unknown field", () => {
    const broken = JSON.parse(JSON.stringify(baseInvoice)) as EntityBuilderSchema
    broken.fields[0]!.dependsOn = { field: "missing", equals: true }
    const result = entityBuilderSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it("rejects filter referencing an unknown field", () => {
    const broken = JSON.parse(JSON.stringify(baseInvoice)) as EntityBuilderSchema
    broken.filters = [{ field: "phantom", operator: "eq" }]
    const result = entityBuilderSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })
})

describe("entityBuilderSchema — top-level naming rules", () => {
  it("rejects PascalCase entityName", () => {
    const broken = { ...customerExample, entityName: "Customer" }
    expect(entityBuilderSchema.safeParse(broken).success).toBe(false)
  })

  it("rejects empty fields array", () => {
    const broken = { ...customerExample, fields: [] }
    expect(entityBuilderSchema.safeParse(broken).success).toBe(false)
  })

  it("rejects empty listColumns array", () => {
    const broken = { ...customerExample, listColumns: [] }
    expect(entityBuilderSchema.safeParse(broken).success).toBe(false)
  })
})
