import { describe, it, expect } from "vitest"
import ts from "typescript"
import {
  generateTypesFile,
  generateSchemaFile,
  generateServiceFile,
  generateConfigFile,
  generateListPageFile,
  generateDetailPageFile,
  generateEditPageFile,
  generateCreatePageFile,
  generateI18nUpdates,
  planGeneration,
} from "../code-generator"
import { invoiceExample, customerExample } from "../../types/examples"

describe("named per-file generators", () => {
  it("each generator returns non-empty source for the invoice schema", () => {
    expect(generateTypesFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateSchemaFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateServiceFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateConfigFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateListPageFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateDetailPageFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateEditPageFile(invoiceExample).length).toBeGreaterThan(0)
    expect(generateCreatePageFile(invoiceExample).length).toBeGreaterThan(0)
  })

  it("create page is the same source as edit page (codebase convention)", () => {
    expect(generateCreatePageFile(customerExample)).toBe(generateEditPageFile(customerExample))
  })

  it("schema file references the correct PascalCase entity name", () => {
    const src = generateSchemaFile(customerExample)
    expect(src).toContain("getCustomerCreateSchema")
    expect(src).toContain("getCustomerUpdateSchema")
    expect(src).toContain("CustomerFormValues")
  })

  it("service file uses the configured endpoint", () => {
    expect(generateServiceFile(invoiceExample)).toContain(`super("/api/app/invoice")`)
  })

  it("list-page references PagePermissionGuard with the entity name", () => {
    expect(generateListPageFile(invoiceExample)).toContain(`entityName="invoice"`)
  })

  it("i18n updates produce per-locale subtree under the entity key", () => {
    const i18n = generateI18nUpdates(invoiceExample)
    expect(i18n.en.invoice).toBeTruthy()
    expect(i18n.ar.invoice).toBeTruthy()
  })

  it("planGeneration aggregates 7 files (4 domain + 3 page)", () => {
    const plan = planGeneration(customerExample)
    expect(plan.files.length).toBe(7)
    expect(plan.entityName).toBe("customer")
    expect(Object.keys(plan.i18n.en)[0]).toBe("customer")
  })

  it("config file is emitted as .config.tsx (not .ts) so it matches handwritten configs", () => {
    const plan = planGeneration(customerExample)
    const configFile = plan.files.find(f => f.path.endsWith(".config.tsx"))
    expect(configFile, "expected a .config.tsx file in the plan").toBeDefined()
    expect(plan.files.find(f => f.path.endsWith(".config.ts"))).toBeUndefined()
    expect(configFile!.language).toBe("tsx")
  })
})

describe("config file: rich-shape emission (parity with handwritten entities)", () => {
  // The handwritten brand.config.tsx is the reference. A generated config
  // satisfies the same EntityConfig shape — every test below pins one
  // required EntityConfig key onto the generator's output.

  it("emits listColumns with field + type + titleKey (in renderer-type terms, not builder display)", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toMatch(/listColumns:\s*\[/)
    // customer's first column is { field: "code", display: "badge-code" } in
    // the builder schema — emitted as renderer-type "badge-code".
    expect(src).toContain(`{ field: "code", type: "badge-code", titleKey: "pages.customer.code" }`)
    // The builder's "text" display gets remapped to the renderer-recognised
    // "text-secondary" (RendererColumnType has no bare "text").
    expect(src).toContain(`type: "text-secondary"`)
  })

  it("emits searchFields covering string / text / email / select / phone fields only", () => {
    const src = generateConfigFile(customerExample)
    // boolean (isActive) and entity-autocomplete (cityId) are NOT searchable
    // free-text — the generator's allowlist excludes those types.
    expect(src).toContain(`searchFields: ["code", "name", "email", "phone"]`)
  })

  it("emits defaultPageSize: 10", () => {
    expect(generateConfigFile(customerExample)).toMatch(/defaultPageSize:\s*10\b/)
  })

  it("emits defaultSort only when a creationTime field exists in the schema", () => {
    // customerExample has no creationTime field — defaultSort must be absent.
    expect(generateConfigFile(customerExample)).not.toMatch(/defaultSort:/)
  })

  it("emits detailSections with a 'primary_information' section listing visible fields", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toMatch(/detailSections:\s*\[/)
    expect(src).toContain(`title: "primary_information"`)
    // Per-field entries inside the section should reference labelKey pages.<entity>.<field>.
    expect(src).toContain(`{ name: "code", type: "text-secondary", labelKey: "pages.customer.code" }`)
  })

  it("emits formFields with EntityConfig-side types (string→text, text→textarea) plus a hidden concurrencyStamp", () => {
    const src = generateConfigFile(customerExample)
    // customer's "code" is builder type "string" → EntityConfig type "text".
    expect(src).toContain(
      `code: { type: "text", labelKey: "pages.customer.code", placeholder: "pages.customer.code_placeholder", required: true }`,
    )
    expect(src).toContain(`concurrencyStamp: { type: "text", hidden: true }`)
  })

  it("emits formFieldOrder matching the schema fields and excludeFields = [concurrencyStamp]", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toContain(`formFieldOrder: ["code", "name", "email", "phone", "isActive", "cityId"]`)
    expect(src).toContain(`excludeFields: ["concurrencyStamp"]`)
  })

  it("emits defaultFormValues with per-type literals", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toMatch(/code:\s*""/)
    expect(src).toMatch(/isActive:\s*false/)
    // entity-autocomplete cityId has no sensible default — emit undefined.
    expect(src).toMatch(/cityId:\s*undefined/)
  })

  it("emits entityToFormData with the right coercion per field type", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toContain(`entityToFormData: (entity: Customer) => ({`)
    // Strings: `|| ""` (handwritten brand uses the same pattern).
    expect(src).toContain(`code: entity.code || ""`)
    // Booleans: `?? false` so an explicit `false` isn't coerced to default.
    expect(src).toContain(`isActive: entity.isActive ?? false`)
    expect(src).toContain(`concurrencyStamp: entity.concurrencyStamp`)
  })

  it("emits a sections-form formLayout when the builder schema has rows, else a 2-column grid", () => {
    // invoiceExample has 4 form rows.
    const invoiceSrc = generateConfigFile(invoiceExample)
    expect(invoiceSrc).toContain(`type: "sections"`)
    expect(invoiceSrc).toContain(`titleKey: "pages.invoice.section_1_title"`)

    // A schema with no formLayout rows falls through to the default grid.
    const noLayout = { ...customerExample, formLayout: [] }
    const noLayoutSrc = generateConfigFile(noLayout)
    expect(noLayoutSrc).toMatch(/type:\s*"grid"/)
    expect(noLayoutSrc).toMatch(/columns:\s*2/)
  })

  it("emits the full translations block referencing pages.<entity>.* keys", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toContain(`listTitle: "pages.customer.title"`)
    expect(src).toContain(`listDescription: "pages.customer.description"`)
    expect(src).toContain(`detailTitle: "pages.customer.detail_title"`)
    expect(src).toContain(`createTitle: "pages.customer.create_title"`)
    expect(src).toContain(`editTitle: "pages.customer.edit_title"`)
    expect(src).toContain(`searchPlaceholder: "pages.customer.searchPlaceholder"`)
    expect(src).toContain(`successCreate: "pages.customer.create_success"`)
    expect(src).toContain(`successUpdate: "pages.customer.update_success"`)
    expect(src).toContain(`successDelete: "pages.customer.delete_success"`)
  })

  it("imports the schema types (so the config compiles with the generated schema file)", () => {
    const src = generateConfigFile(customerExample)
    expect(src).toContain(
      `import {\n  getCustomerCreateSchema,\n  getCustomerUpdateSchema,\n  type CustomerFormValues,\n}`,
    )
  })

  it("matches the canonical snapshot for the invoice fixture", () => {
    // Snapshot the whole config so any unannounced shape change shows up as
    // a diff in the PR. Use the toolchain-default snapshot directory.
    expect(generateConfigFile(invoiceExample)).toMatchSnapshot()
  })
})

describe("config file: structural TS validity via ts.transpileModule", () => {
  // Compile the generated config to JS in isolation. This catches syntax
  // errors (a stray `}`, a malformed object-literal key) and TS-level
  // grammar issues (bad type-annotation, malformed import). It doesn't
  // resolve cross-file types — that's covered by `npm run type-check` once
  // the materialised file is on disk.

  it("invoice config transpiles with zero diagnostics", () => {
    const src = generateConfigFile(invoiceExample)
    const result = ts.transpileModule(src, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.Preserve,
        // The generator emits `import type { … }` and uses esModuleInterop
        // shapes when re-exporting. Pin the same flags `tsconfig.json` does.
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
    })
    const diagnostics = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    if (diagnostics.length > 0) {
      const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n---\n")
      throw new Error(`transpile produced ${diagnostics.length} error(s):\n${messages}`)
    }
  })

  it("customer config transpiles with zero diagnostics", () => {
    const src = generateConfigFile(customerExample)
    const result = ts.transpileModule(src, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.Preserve,
        esModuleInterop: true,
      },
    })
    const errs = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
    expect(errs).toEqual([])
  })
})

describe("config file: per-type extras emitted for the newly-exposed runtime types", () => {
  // Build a synthetic builder schema in-line so we don't have to thread
  // these through the example fixtures (those serve security + snapshot
  // tests and shouldn't grow whenever a new field type gets exposed).
  function schemaWithField(field: Partial<import("../../types/builder-schema").EntityFieldDefinition>) {
    return {
      entityName: "synthetic",
      entityNamePlural: "synthetics",
      domain: "runtime",
      endpoint: "/api/app/synthetic",
      permissionKey: "Api.Synthetic",
      translations: {
        en: { title: "Synthetics" },
        ar: { title: "Synthetics" },
      },
      fields: [
        {
          name: "f",
          label: { en: "F", ar: "F" },
          type: "string",
          ...field,
        },
      ],
      listColumns: [{ field: "f", display: "text", sortable: true, hidden: false }],
      detailLayout: [],
      formLayout: [],
      features: { create: true, edit: true, delete: true, view: true, export: false, import: false },
    } as import("../../types/builder-schema").EntityBuilderSchema
  }

  it("emits currencyCode on currency fields", () => {
    const src = generateConfigFile(schemaWithField({ name: "price", type: "currency", currencyCode: "EUR" }))
    expect(src).toContain(`currencyCode: "EUR"`)
  })

  it("emits accept + maxSizeKB on file/image fields", () => {
    const src = generateConfigFile(
      schemaWithField({ name: "photo", type: "image", accept: "image/*", maxSizeKB: 2048 }),
    )
    expect(src).toContain(`accept: "image/*"`)
    expect(src).toContain(`maxSizeKB: 2048`)
  })

  it("emits multiple: true on multi-select fields", () => {
    const src = generateConfigFile(
      schemaWithField({
        name: "tags",
        type: "multi-select",
        options: [{ value: "a", labelKey: "pages.synthetic.options.tags.a" }],
      }),
    )
    expect(src).toContain(`multiple: true`)
  })

  it("emits entityName + displayField on entity-autocomplete fields", () => {
    const src = generateConfigFile(
      schemaWithField({ name: "owner", type: "entity-autocomplete", entityRef: "user", displayField: "fullName" }),
    )
    expect(src).toContain(`entityName: "user"`)
    expect(src).toContain(`displayField: "fullName"`)
  })

  it("emits z.string().email() for email fields", () => {
    const src = generateSchemaFile(schemaWithField({ name: "contact", type: "email" }))
    expect(src).toMatch(/contact: z\.string\(\)\.email\(\)/)
  })

  it("emits z.string().url() for url fields", () => {
    const src = generateSchemaFile(schemaWithField({ name: "link", type: "url" }))
    expect(src).toMatch(/link: z\.string\(\)\.url\(\)/)
  })

  it("emits z.array(z.string()) for multi-select fields", () => {
    const src = generateSchemaFile(
      schemaWithField({
        name: "tags",
        type: "multi-select",
        options: [{ value: "a", labelKey: "pages.synthetic.options.tags.a" }],
      }),
    )
    expect(src).toMatch(/tags: z\.array\(z\.string\(\)\)/)
  })

  it("emits 'string | File' as the TS type for file/image fields", () => {
    const src = generateTypesFile(schemaWithField({ name: "photo", type: "image" }))
    expect(src).toContain(`photo?: string | File`)
  })
})

describe("i18n extractor: covers every key referenced by the rich config", () => {
  it("emits the full per-entity translation surface", () => {
    const i18n = generateI18nUpdates(customerExample)
    const sub = i18n.en.customer as Record<string, unknown>
    // Top-level entity keys
    for (const k of [
      "title",
      "description",
      "searchPlaceholder",
      "detail_title",
      "create_title",
      "edit_title",
      "create_success",
      "update_success",
      "delete_success",
    ]) {
      expect(sub, `missing top-level key ${k}`).toHaveProperty(k)
    }
    // Per-field labels + placeholders
    for (const f of customerExample.fields) {
      expect(sub).toHaveProperty(f.name)
      expect(sub).toHaveProperty(`${f.name}_placeholder`)
    }
  })

  it("AR mirrors EN where the schema has no explicit Arabic value (success toasts, section titles)", () => {
    const i18n = generateI18nUpdates(customerExample)
    const en = i18n.en.customer as Record<string, string>
    const ar = i18n.ar.customer as Record<string, string>
    // Section titles come from formLayout rows that have no sectionTitle —
    // both locales fall back to the same synthesised string.
    if ("section_1_title" in en) {
      expect(ar.section_1_title).toBe(en.section_1_title)
    }
    // Success toasts are synthesised from title — mirror semantics means
    // AR's success-toast values match EN's exactly (admin overwrites later).
    expect(ar.create_success).toBe(en.create_success)
  })
})
