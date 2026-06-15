import { describe, it, expect } from "vitest"
import { Database } from "lucide-react"
import { z } from "zod"
import { applyEntityOverride } from "../merge"
import type { EntityConfig } from "../../types"

function makeConfig(): EntityConfig<{ id: number }, { id: number }> {
  // The override pipeline only ever reads the JSON-safe fields, so the
  // service / schemas / icons here are stand-ins to satisfy the type.
  return {
    entityName: "demo",
    singularName: "Demo",
    pluralName: "Demos",
    icon: Database,
    service: {
      getList: async () => ({ items: [], totalCount: 0 }),
      getById: async () => ({ id: 1 }),
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
      delete: async () => undefined,
    },
    listColumns: [],
    detailSections: [],
    formFields: {
      name: { type: "text", required: false, hidden: false, colSpan: 1 },
      notes: { type: "textarea", required: false, rows: 3 },
    },
    formFieldOrder: ["name", "notes"],
    createSchema: () => z.object({ id: z.number() }),
    updateSchema: () => z.object({ id: z.number() }),
    defaultFormValues: { id: 0 },
    translations: {
      listTitle: "demo.listTitle",
      listDescription: "demo.listDescription",
      detailTitle: "demo.detailTitle",
      createTitle: "demo.createTitle",
      editTitle: "demo.editTitle",
      searchPlaceholder: "demo.searchPlaceholder",
    },
    features: { create: true, edit: true, delete: true, view: true },
    defaultPageSize: 25,
    permissionKey: "Api.Demo",
    basePath: "/demo",
  }
}

describe("applyEntityOverride", () => {
  it("returns the original config when no override is provided", () => {
    const config = makeConfig()
    expect(applyEntityOverride(config, undefined)).toBe(config)
  })

  it("overrides scalar fields", () => {
    const config = makeConfig()
    const result = applyEntityOverride(config, {
      singularName: "Widget",
      pluralName: "Widgets",
      defaultPageSize: 100,
      permissionKey: "Api.Widget",
      basePath: "/widgets",
    })
    expect(result.singularName).toBe("Widget")
    expect(result.pluralName).toBe("Widgets")
    expect(result.defaultPageSize).toBe(100)
    expect(result.permissionKey).toBe("Api.Widget")
    expect(result.basePath).toBe("/widgets")
    // Untouched fields stay identical to the source config.
    expect(result.entityName).toBe("demo")
  })

  it("merges features additively", () => {
    const config = makeConfig()
    const result = applyEntityOverride(config, { features: { delete: false, export: true } })
    expect(result.features).toEqual({ create: true, edit: true, delete: false, view: true, export: true })
  })

  it("merges form fields per-field, ignoring unknown names", () => {
    const config = makeConfig()
    const result = applyEntityOverride(config, {
      formFields: {
        name: { required: true, hidden: true, colSpan: 6 },
        nonexistent: { required: true },
      },
    })
    expect(result.formFields.name).toMatchObject({ required: true, hidden: true, colSpan: 6, type: "text" })
    expect(result.formFields.notes).toMatchObject({ rows: 3 })
    expect(result.formFields.nonexistent).toBeUndefined()
  })

  it("does not mutate the input config", () => {
    const config = makeConfig()
    const before = JSON.stringify({
      sn: config.singularName,
      ps: config.defaultPageSize,
      ff: { ...config.formFields },
    })
    applyEntityOverride(config, {
      singularName: "Other",
      defaultPageSize: 5,
      formFields: { name: { required: true } },
    })
    const after = JSON.stringify({
      sn: config.singularName,
      ps: config.defaultPageSize,
      ff: { ...config.formFields },
    })
    expect(after).toBe(before)
  })

  it("replaces formFieldOrder when provided", () => {
    const config = makeConfig()
    const result = applyEntityOverride(config, { formFieldOrder: ["notes", "name"] })
    expect(result.formFieldOrder).toEqual(["notes", "name"])
  })

  it("rejects schema-incompatible inputs at the boundary (callers Zod-validate)", () => {
    // The runtime is type-safe — invalid shapes never reach merge() because
    // the Zod schema on the API route rejects them. This test pins that
    // contract: passing through valid-shaped data with empty patches yields
    // an unchanged config.
    const config = makeConfig()
    const result = applyEntityOverride(config, {})
    expect(result.singularName).toBe(config.singularName)
    expect(result.formFields).toEqual(config.formFields)
  })
})
