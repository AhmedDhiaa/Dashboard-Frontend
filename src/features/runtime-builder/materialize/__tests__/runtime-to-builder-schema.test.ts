/**
 * Mapper coverage for every newly-exposed RuntimeFieldType.
 *
 * The contract under test: a RuntimeField with the new per-type sub-config
 * round-trips into an EntityFieldDefinition that the builder-schema's Zod
 * validator accepts AND that the code generator can emit without falling
 * through to a no-op string fallback.
 */

import { describe, expect, it } from "vitest"
import { mapRuntimeEntityToBuilderSchema } from "../runtime-to-builder-schema"
import { entityBuilderSchema } from "@/features/admin-tools/entity-builder/types/builder-schema"
import type { RuntimeEntity, RuntimeField } from "../../types"

function makeEntity(field: RuntimeField): RuntimeEntity {
  return {
    id: "widgets",
    pluralName: "Widgets",
    singularName: "Widget",
    fields: [field],
    createdAt: 0,
    updatedAt: 0,
  }
}

function map(field: RuntimeField) {
  const out = mapRuntimeEntityToBuilderSchema(makeEntity(field))
  // Verify the builder-schema validates the mapper's output — guards against
  // a future mapper bug that emits a shape Zod would reject.
  const parsed = entityBuilderSchema.safeParse(out)
  expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true)
  return out.fields[0]!
}

describe("mapper: per-type translation", () => {
  it.each([
    ["text", "string"],
    ["textarea", "text"],
    ["richtext", "richtext"],
    ["number", "number"],
    ["boolean", "boolean"],
    ["date", "date"],
    ["datetime", "datetime"],
    ["time", "time"],
    ["email", "email"],
    ["phone", "phone"],
    ["url", "url"],
    ["color", "color"],
    ["percentage", "percentage"],
  ] as const)("maps RuntimeFieldType=%s → builder type=%s", (runtimeType, builderType) => {
    const f = map({ key: "f", label: "F", type: runtimeType })
    expect(f.type).toBe(builderType)
  })
})

describe("mapper: Arabic labels (with English fallback)", () => {
  function fullEntity(overrides: Partial<RuntimeEntity>): RuntimeEntity {
    return {
      id: "customers",
      pluralName: "Customers",
      singularName: "Customer",
      fields: [{ key: "name", label: "Name", type: "text", isTitle: true }],
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    }
  }

  it("uses author-provided Arabic for title, description, field label, and detail title", () => {
    const out = mapRuntimeEntityToBuilderSchema(
      fullEntity({
        pluralNameAr: "العملاء",
        singularNameAr: "عميل",
        descriptionAr: "إدارة العملاء",
        fields: [{ key: "name", label: "Name", labelAr: "الاسم", type: "text", isTitle: true }],
      }),
    )
    expect(out.translations.ar.title).toBe("العملاء")
    expect(out.translations.ar.description).toBe("إدارة العملاء")
    expect(out.translations.en.title).toBe("Customers")
    expect(out.fields[0]!.label).toEqual({ en: "Name", ar: "الاسم" })
    expect(out.detailLayout[0]!.title).toEqual({ en: "Customer", ar: "عميل" })
  })

  it("falls back to English when Arabic is absent (no mirrored-English surprises)", () => {
    const out = mapRuntimeEntityToBuilderSchema(fullEntity({}))
    expect(out.translations.ar.title).toBe("Customers")
    expect(out.fields[0]!.label).toEqual({ en: "Name", ar: "Name" })
    expect(out.detailLayout[0]!.title.ar).toBe("Customer")
  })

  it("treats a blank/whitespace Arabic value as absent (trims to fallback)", () => {
    const out = mapRuntimeEntityToBuilderSchema(
      fullEntity({
        pluralNameAr: "   ",
        fields: [{ key: "name", label: "Name", labelAr: "  ", type: "text", isTitle: true }],
      }),
    )
    expect(out.translations.ar.title).toBe("Customers")
    expect(out.fields[0]!.label.ar).toBe("Name")
  })
})

describe("mapper: currency carries currencyCode through", () => {
  it("forwards currencyCode onto EntityFieldDefinition", () => {
    const f = map({
      key: "price",
      label: "Price",
      type: "currency",
      currencyConfig: { currencyCode: "EUR", locale: "en-EU" },
    })
    expect(f.type).toBe("currency")
    expect(f.currencyCode).toBe("EUR")
  })

  it("omits currencyCode when no config is set", () => {
    const f = map({ key: "price", label: "Price", type: "currency" })
    expect(f.currencyCode).toBeUndefined()
  })
})

describe("mapper: file/image carries accept + maxSizeKB through", () => {
  it("joins the accept array into the builder-schema comma-separated string", () => {
    const f = map({
      key: "photo",
      label: "Photo",
      type: "image",
      fileConfig: { accept: ["image/*", ".pdf"], maxSizeKB: 2048 },
    })
    expect(f.type).toBe("image")
    expect(f.accept).toBe("image/*,.pdf")
    expect(f.maxSizeKB).toBe(2048)
  })

  it("drops accept entirely when the runtime array is empty", () => {
    const f = map({ key: "doc", label: "Doc", type: "file", fileConfig: { accept: [] } })
    expect(f.accept).toBeUndefined()
  })
})

describe("mapper: entity-autocomplete carries the target + displayField through", () => {
  it("forwards target + display field", () => {
    const f = map({
      key: "owner",
      label: "Owner",
      type: "entity-autocomplete",
      entityAutocompleteConfig: { targetEntityName: "user", displayField: "fullName" },
    })
    expect(f.type).toBe("entity-autocomplete")
    expect(f.entityRef).toBe("user")
    expect(f.displayField).toBe("fullName")
  })
})

describe("mapper: multi-select uses the same labelKey synthesis as select", () => {
  it("emits the same namespaced labelKey path for options", () => {
    const f = map({
      key: "tags",
      label: "Tags",
      type: "multi-select",
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
    })
    expect(f.type).toBe("multi-select")
    expect(f.options).toEqual([
      { value: "a", labelKey: "pages.widgets.options.tags.a" },
      { value: "b", labelKey: "pages.widgets.options.tags.b" },
    ])
  })
})
