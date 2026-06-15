import { describe, expect, it } from "vitest"
import {
  fieldSchema,
  localizedStringSchema,
  kebabIdSchema,
  fieldNameSchema,
  permissionKeySchema,
  PAGE_BUILDER_FIELD_TYPES,
} from "../field-schema"
import { MASTER_FIELD_TYPES } from "@/core/entities/field-types"

describe("localizedStringSchema", () => {
  it("accepts an EN/AR pair", () => {
    expect(() => localizedStringSchema.parse({ en: "Title", ar: "عنوان" })).not.toThrow()
  })

  it("rejects missing locale", () => {
    expect(() => localizedStringSchema.parse({ en: "Only English" })).toThrow()
  })

  it("rejects strings over 500 chars", () => {
    expect(() => localizedStringSchema.parse({ en: "a".repeat(501), ar: "ب" })).toThrow()
  })
})

describe("identifier patterns", () => {
  it("kebab id accepts kebab-case (2-41 chars)", () => {
    expect(() => kebabIdSchema.parse("orders-list")).not.toThrow()
    expect(() => kebabIdSchema.parse("ab")).not.toThrow()
  })

  it("kebab id rejects single char, PascalCase, snake_case, leading digit", () => {
    expect(() => kebabIdSchema.parse("a")).toThrow()
    expect(() => kebabIdSchema.parse("OrdersList")).toThrow()
    expect(() => kebabIdSchema.parse("orders_list")).toThrow()
    expect(() => kebabIdSchema.parse("1orders")).toThrow()
  })

  it("field name accepts lowerCamelCase + snake_case", () => {
    expect(() => fieldNameSchema.parse("totalAmount")).not.toThrow()
    expect(() => fieldNameSchema.parse("is_active")).not.toThrow()
  })

  it("field name rejects kebab-case + leading uppercase", () => {
    expect(() => fieldNameSchema.parse("total-amount")).toThrow()
    expect(() => fieldNameSchema.parse("TotalAmount")).toThrow()
  })

  it("permission key requires Api. namespace + PascalCase", () => {
    expect(() => permissionKeySchema.parse("Api.Order")).not.toThrow()
    expect(() => permissionKeySchema.parse("Api.Order.Update")).not.toThrow()
  })

  it("permission key rejects non-Api roots and non-PascalCase", () => {
    expect(() => permissionKeySchema.parse("AbpIdentity.Roles")).toThrow()
    expect(() => permissionKeySchema.parse("Api.order")).toThrow()
    expect(() => permissionKeySchema.parse("api.Order")).toThrow()
  })
})

describe("PAGE_BUILDER_FIELD_TYPES", () => {
  it("contains exactly 29 entries (per spec §3)", () => {
    expect(PAGE_BUILDER_FIELD_TYPES.length).toBe(29)
  })

  it("every Page Builder type is also a master type (SSOT invariant)", () => {
    for (const t of PAGE_BUILDER_FIELD_TYPES) {
      expect(MASTER_FIELD_TYPES).toContain(t)
    }
  })

  it("covers the 13 entity-config types from src/core/entities/types.ts", () => {
    const entityConfigTypes = [
      "text",
      "number",
      "textarea",
      "select",
      "autocomplete",
      "date",
      "datetime",
      "boolean",
      "file",
      "custom",
      "password",
      "email",
      "enum",
    ] as const
    for (const t of entityConfigTypes) {
      expect(PAGE_BUILDER_FIELD_TYPES).toContain(t)
    }
  })
})

describe("fieldSchema — happy path", () => {
  it("accepts a minimal text field", () => {
    const parsed = fieldSchema.parse({
      name: "title",
      type: "text",
      label: { en: "Title", ar: "العنوان" },
    })
    expect(parsed.required).toBe(false)
    expect(parsed.showInForm).toBe(true)
    expect(parsed.showInDetail).toBe(true)
    expect(parsed.showInList).toBe(false)
  })

  it("accepts every Page Builder type in turn", () => {
    for (const type of PAGE_BUILDER_FIELD_TYPES) {
      expect(() =>
        fieldSchema.parse({
          name: "fieldX",
          type,
          label: { en: "X", ar: "س" },
        }),
      ).not.toThrow()
    }
  })

  it("accepts a select field with options", () => {
    expect(() =>
      fieldSchema.parse({
        name: "status",
        type: "select",
        label: { en: "Status", ar: "الحالة" },
        options: [
          { value: "open", label: { en: "Open", ar: "مفتوح" } },
          { value: "closed", label: { en: "Closed", ar: "مغلق" } },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts an autocomplete field", () => {
    expect(() =>
      fieldSchema.parse({
        name: "owner",
        type: "autocomplete",
        label: { en: "Owner", ar: "المالك" },
        autocomplete: {
          entityName: "user",
          valueField: "id",
          labelField: "name",
        },
      }),
    ).not.toThrow()
  })

  it("accepts a textarea field with rows + condition + permission", () => {
    expect(() =>
      fieldSchema.parse({
        name: "notes",
        type: "textarea",
        label: { en: "Notes", ar: "ملاحظات" },
        rows: 4,
        permission: "Api.Order.Update",
        condition: { field: "status", operator: "eq", value: "open" },
      }),
    ).not.toThrow()
  })
})

describe("fieldSchema — validation failures", () => {
  it("rejects an unknown field type", () => {
    expect(() =>
      fieldSchema.parse({
        name: "x",
        type: "totally-not-a-field-type",
        label: { en: "X", ar: "س" },
      }),
    ).toThrow()
  })

  it("rejects a missing label", () => {
    expect(() =>
      fieldSchema.parse({
        name: "x",
        type: "text",
      }),
    ).toThrow()
  })

  it("rejects an invalid field name", () => {
    expect(() =>
      fieldSchema.parse({
        name: "Total-Amount",
        type: "number",
        label: { en: "X", ar: "س" },
      }),
    ).toThrow()
  })

  it("rejects an invalid permission key", () => {
    expect(() =>
      fieldSchema.parse({
        name: "x",
        type: "text",
        label: { en: "X", ar: "س" },
        permission: "not-a-permission",
      }),
    ).toThrow()
  })

  it("rejects a non-positive rows", () => {
    expect(() =>
      fieldSchema.parse({
        name: "notes",
        type: "textarea",
        label: { en: "X", ar: "س" },
        rows: 0,
      }),
    ).toThrow()
  })

  it("rejects a non-integer minLength", () => {
    expect(() =>
      fieldSchema.parse({
        name: "x",
        type: "text",
        label: { en: "X", ar: "س" },
        validation: { minLength: 1.5 },
      }),
    ).toThrow()
  })
})
