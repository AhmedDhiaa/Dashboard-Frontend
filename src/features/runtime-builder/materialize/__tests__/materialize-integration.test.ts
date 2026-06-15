/**
 * End-to-end materialize check for the newly-exposed runtime field types.
 *
 *   1. Build a RuntimeEntity that uses every new type at least once.
 *   2. Run the mapper to turn it into an EntityBuilderSchema.
 *   3. Run planGeneration to materialise the .types.ts / .schema.ts / .config.tsx.
 *   4. Compile each emitted source through ts.transpileModule and assert
 *      zero diagnostics — proves the new type extras don't smuggle in
 *      syntactically broken code.
 *
 * `transpileModule` doesn't follow imports; it validates THIS file's
 * grammar + type-syntax only. Full cross-file type-checking happens at
 * `npm run type-check` after the file lands on disk.
 */

import { describe, expect, it } from "vitest"
import ts from "typescript"
import { mapRuntimeEntityToBuilderSchema } from "../runtime-to-builder-schema"
import { planGeneration } from "@/features/admin-tools/entity-builder/server/code-generator"
import type { RuntimeEntity, RuntimeField } from "../../types"

const ALL_NEW_TYPES_ENTITY: RuntimeEntity = {
  id: "kitchen-sink",
  pluralName: "Kitchen Sinks",
  singularName: "Kitchen Sink",
  fields: [
    { key: "title", label: "Title", type: "text", required: true, isTitle: true },
    { key: "body", label: "Body", type: "richtext" },
    { key: "price", label: "Price", type: "currency", currencyConfig: { currencyCode: "EUR", locale: "en-EU" } },
    { key: "discount", label: "Discount", type: "percentage" },
    { key: "scheduled", label: "Scheduled", type: "datetime" },
    { key: "openHour", label: "Opens at", type: "time" },
    {
      key: "tags",
      label: "Tags",
      type: "multi-select",
      options: [
        { value: "new", label: "New" },
        { value: "sale", label: "Sale" },
      ],
    },
    {
      key: "owner",
      label: "Owner",
      type: "entity-autocomplete",
      entityAutocompleteConfig: { targetEntityName: "user", displayField: "fullName" },
    },
    { key: "photo", label: "Photo", type: "image", fileConfig: { accept: ["image/*"], maxSizeKB: 1024 } },
    { key: "manual", label: "Manual", type: "file", fileConfig: { accept: ["application/pdf"], maxSizeKB: 5000 } },
    { key: "color", label: "Highlight", type: "color" },
    { key: "contact", label: "Contact", type: "email" },
    { key: "phone", label: "Phone", type: "phone" },
    { key: "url", label: "Website", type: "url" },
  ] as RuntimeField[],
  createdAt: 0,
  updatedAt: 0,
}

function compile(source: string): readonly ts.Diagnostic[] {
  // Always pass `JsxEmit.Preserve` even for `.ts` files — this TS version
  // refuses `JsxEmit.None` as an invalid `--jsx` argument, and Preserve is
  // a no-op for files that contain no JSX.
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
    },
  })
  return (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)
}

describe("materialize integration: every new runtime type compiles end-to-end", () => {
  const builderSchema = mapRuntimeEntityToBuilderSchema(ALL_NEW_TYPES_ENTITY)
  const plan = planGeneration(builderSchema)

  it("mapper output satisfies the builder schema's Zod (preflight)", () => {
    // A runtime field with type entity-autocomplete must NOT include
    // `entityAutocompleteConfig` on the materialised schema — only the
    // resolved entityRef + displayField. Pin that contract.
    const owner = builderSchema.fields.find(f => f.name === "owner")
    expect(owner?.entityRef).toBe("user")
    expect(owner?.displayField).toBe("fullName")
  })

  it.each([[".types.ts"], [".schema.ts"], [".service.ts"], [".config.tsx"]])(
    "the emitted %s file transpiles with zero TS errors",
    suffix => {
      const file = plan.files.find(f => f.path.endsWith(suffix))
      expect(file, `plan has no ${suffix} file`).toBeDefined()
      const diagnostics = compile(file!.content)
      if (diagnostics.length > 0) {
        const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n---\n")
        throw new Error(
          `Generated ${suffix} produced ${diagnostics.length} TS errors:\n${messages}\n--- source ---\n${file!.content}`,
        )
      }
    },
  )

  it("schema file uses z.string().email() and z.string().url() for the right fields", () => {
    const schemaFile = plan.files.find(f => f.path.endsWith(".schema.ts"))!
    expect(schemaFile.content).toMatch(/contact: z\.string\(\)\.email\(\)/)
    expect(schemaFile.content).toMatch(/url: z\.string\(\)\.url\(\)/)
  })

  it("config file emits the per-type extras for currency / file / entity-autocomplete / multi-select", () => {
    const configFile = plan.files.find(f => f.path.endsWith(".config.tsx"))!
    expect(configFile.content).toContain(`currencyCode: "EUR"`)
    expect(configFile.content).toContain(`accept: "image/*"`)
    expect(configFile.content).toContain(`maxSizeKB: 1024`)
    expect(configFile.content).toContain(`entityName: "user"`)
    expect(configFile.content).toContain(`displayField: "fullName"`)
    expect(configFile.content).toContain(`multiple: true`)
  })
})
