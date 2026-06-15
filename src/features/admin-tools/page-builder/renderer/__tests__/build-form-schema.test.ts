import { describe, it, expect } from "vitest"
import { fieldSchema, type FieldSchema } from "../../schema/field-schema"
import { buildZodSchema, buildFieldConfig, buildDefaultValues, mapFieldTypeToFormFieldType } from "../build-form-schema"

// Test fields are constructed via `fieldSchema.parse` so each one is a
// fully-typed FieldSchema with every default applied — we cannot drift
// from the canonical shape silently.
function makeField(overrides: Partial<FieldSchema> & Pick<FieldSchema, "name" | "type" | "label">): FieldSchema {
  return fieldSchema.parse({
    name: overrides.name,
    type: overrides.type,
    label: overrides.label,
    description: overrides.description,
    placeholder: overrides.placeholder,
    required: overrides.required,
    hidden: overrides.hidden,
    disabled: overrides.disabled,
    defaultValue: overrides.defaultValue,
    validation: overrides.validation,
    options: overrides.options,
    enumType: overrides.enumType,
    autocomplete: overrides.autocomplete,
    rows: overrides.rows,
    step: overrides.step,
    accept: overrides.accept,
    colSpan: overrides.colSpan,
    showInList: overrides.showInList,
    showInDetail: overrides.showInDetail,
    showInForm: overrides.showInForm,
    condition: overrides.condition,
    permission: overrides.permission,
  })
}

describe("buildZodSchema", () => {
  it("emits an object schema with one entry per visible field", () => {
    const fields = [
      makeField({ name: "name", type: "text", label: { en: "Name", ar: "الاسم" } }),
      makeField({ name: "age", type: "number", label: { en: "Age", ar: "العمر" } }),
      makeField({ name: "active", type: "boolean", label: { en: "Active", ar: "نشط" } }),
    ]
    const schema = buildZodSchema(fields)
    expect(Object.keys(schema.shape)).toEqual(["name", "age", "active"])
  })

  it("flags a missing required field on safeParse({})", () => {
    const fields = [makeField({ name: "name", type: "text", label: { en: "Name", ar: "الاسم" }, required: true })]
    const schema = buildZodSchema(fields)
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects a non-email value when field.type === 'email'", () => {
    const fields = [makeField({ name: "email", type: "email", label: { en: "Email", ar: "البريد" }, required: true })]
    const schema = buildZodSchema(fields)
    const result = schema.safeParse({ email: "x" })
    expect(result.success).toBe(false)
  })

  it("rejects a string shorter than validation.minLength", () => {
    const fields = [
      makeField({
        name: "name",
        type: "text",
        label: { en: "Name", ar: "الاسم" },
        required: true,
        validation: { minLength: 3 },
      }),
    ]
    const schema = buildZodSchema(fields)
    const result = schema.safeParse({ name: "ab" })
    expect(result.success).toBe(false)
  })

  it("rejects a string longer than validation.maxLength", () => {
    const fields = [
      makeField({
        name: "name",
        type: "text",
        label: { en: "Name", ar: "الاسم" },
        required: true,
        validation: { maxLength: 3 },
      }),
    ]
    const schema = buildZodSchema(fields)
    expect(schema.safeParse({ name: "abcd" }).success).toBe(false)
    expect(schema.safeParse({ name: "abc" }).success).toBe(true)
  })

  it("enforces validation.min / validation.max for numbers", () => {
    const fields = [
      makeField({
        name: "age",
        type: "number",
        label: { en: "Age", ar: "العمر" },
        required: true,
        validation: { min: 18, max: 120 },
      }),
    ]
    const schema = buildZodSchema(fields)
    expect(schema.safeParse({ age: 17 }).success).toBe(false)
    expect(schema.safeParse({ age: 200 }).success).toBe(false)
    expect(schema.safeParse({ age: 30 }).success).toBe(true)
  })

  it("excludes hidden fields from the schema entirely", () => {
    const fields = [
      makeField({ name: "name", type: "text", label: { en: "Name", ar: "الاسم" } }),
      makeField({ name: "secret", type: "text", label: { en: "Secret", ar: "سر" }, hidden: true, required: true }),
    ]
    const schema = buildZodSchema(fields)
    expect(Object.keys(schema.shape)).toEqual(["name"])
    // A hidden required field cannot block submission because it isn't in
    // the schema.
    expect(schema.safeParse({ name: "anything" }).success).toBe(true)
  })

  it("accepts a missing optional field", () => {
    const fields = [
      makeField({ name: "nickname", type: "text", label: { en: "Nickname", ar: "اللقب" }, required: false }),
    ]
    const schema = buildZodSchema(fields)
    expect(schema.safeParse({}).success).toBe(true)
  })

  it("validates a multi-select field as an array of strings", () => {
    const fields = [
      makeField({ name: "tags", type: "multi-select", label: { en: "Tags", ar: "وسوم" }, required: true }),
    ]
    const schema = buildZodSchema(fields)
    expect(schema.safeParse({ tags: "not-an-array" }).success).toBe(false)
    expect(schema.safeParse({ tags: [] }).success).toBe(true)
    expect(schema.safeParse({ tags: ["a", "b"] }).success).toBe(true)
  })
})

describe("buildFieldConfig", () => {
  it("maps page-builder field types to FormFieldConfig.type and copies metadata", () => {
    const fields = [
      makeField({
        name: "title",
        type: "text",
        label: { en: "Title", ar: "العنوان" },
        placeholder: { en: "Enter title", ar: "أدخل العنوان" },
        required: true,
        rows: 2,
        colSpan: 6,
      }),
    ]
    const cfg = buildFieldConfig(fields)
    expect(cfg.title).toMatchObject({
      type: "text",
      label: "Title",
      placeholder: "Enter title",
      required: true,
      rows: 2,
      colSpan: 6,
    })
  })

  it("forwards autocomplete metadata into entityName / valueKey / customEndpoint", () => {
    const fields = [
      makeField({
        name: "city",
        type: "autocomplete",
        label: { en: "City", ar: "المدينة" },
        autocomplete: {
          entityName: "city",
          apiEndpoint: "/api/lookup/cities",
          valueField: "id",
          labelField: "name",
        },
      }),
    ]
    const cfg = buildFieldConfig(fields)
    expect(cfg.city).toMatchObject({
      type: "autocomplete",
      entityName: "city",
      valueKey: "id",
      customEndpoint: "/api/lookup/cities",
    })
  })

  it("flags multi-select / multi-autocomplete fields with `multiple: true`", () => {
    const fields = [
      makeField({ name: "tags", type: "multi-select", label: { en: "Tags", ar: "وسوم" } }),
      makeField({
        name: "owners",
        type: "multi-autocomplete",
        label: { en: "Owners", ar: "الملاك" },
        autocomplete: { valueField: "id", labelField: "name" },
      }),
    ]
    const cfg = buildFieldConfig(fields)
    expect(cfg.tags?.multiple).toBe(true)
    expect(cfg.owners?.multiple).toBe(true)
  })

  it("includes hidden fields so the renderer can skip them via the hidden flag", () => {
    const fields = [makeField({ name: "id", type: "text", label: { en: "Id", ar: "المعرف" }, hidden: true })]
    const cfg = buildFieldConfig(fields)
    expect(cfg.id?.hidden).toBe(true)
  })
})

describe("buildDefaultValues", () => {
  it("uses each field's declared defaultValue when present", () => {
    const fields = [
      makeField({
        name: "country",
        type: "text",
        label: { en: "Country", ar: "البلد" },
        defaultValue: "IQ",
      }),
    ]
    expect(buildDefaultValues(fields)).toEqual({ country: "IQ" })
  })

  it("falls back to type-appropriate seeds for fields without a defaultValue", () => {
    const fields = [
      makeField({ name: "name", type: "text", label: { en: "Name", ar: "ا" } }),
      makeField({ name: "active", type: "boolean", label: { en: "Active", ar: "ا" } }),
      makeField({ name: "tags", type: "multi-select", label: { en: "Tags", ar: "ا" } }),
      makeField({ name: "age", type: "number", label: { en: "Age", ar: "ا" } }),
    ]
    expect(buildDefaultValues(fields)).toEqual({
      name: "",
      active: false,
      tags: [],
      age: undefined,
    })
  })
})

describe("mapFieldTypeToFormFieldType", () => {
  it("maps Page Builder types onto the 13-value FormFieldConfig subset", () => {
    expect(mapFieldTypeToFormFieldType("text")).toBe("text")
    expect(mapFieldTypeToFormFieldType("email")).toBe("email")
    expect(mapFieldTypeToFormFieldType("textarea")).toBe("textarea")
    expect(mapFieldTypeToFormFieldType("currency")).toBe("number")
    expect(mapFieldTypeToFormFieldType("switch")).toBe("boolean")
    expect(mapFieldTypeToFormFieldType("autocomplete")).toBe("autocomplete")
    expect(mapFieldTypeToFormFieldType("multi-autocomplete")).toBe("autocomplete")
    expect(mapFieldTypeToFormFieldType("image")).toBe("file")
    expect(mapFieldTypeToFormFieldType("color")).toBe("custom")
  })
})
