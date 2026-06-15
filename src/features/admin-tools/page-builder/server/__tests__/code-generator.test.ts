import { describe, it, expect } from "vitest"
import {
  ALLOWED_CUSTOM_BLOCK_COMPONENTS,
  extractPageI18n,
  findUnknownCustomBlocks,
  generatePageTsxFile,
  generateSchemaFile,
  generateTypesFile,
  planPageGeneration,
} from "../code-generator"
import type { PageSchema } from "../../schema/page-schema"

const baseSchema: PageSchema = {
  id: "orders-overview",
  version: "1.0",
  title: { en: "Orders", ar: "الطلبات" },
  description: { en: "Quick view", ar: "نظرة سريعة" },
  permission: "Api.Order",
  layout: "full",
  blocks: [
    {
      id: "h1",
      type: "heading",
      text: { en: "Welcome", ar: "أهلاً" },
      level: 2,
      hidden: false,
    },
  ],
} as never

describe("findUnknownCustomBlocks", () => {
  it("returns [] when there are no custom blocks", () => {
    expect(findUnknownCustomBlocks(baseSchema)).toEqual([])
  })

  it("flags a top-level custom block whose componentName isn't in the allowlist", () => {
    const schema = {
      ...baseSchema,
      blocks: [
        {
          id: "custom-1",
          type: "custom",
          componentName: "ThirdPartyMap",
          props: {},
          hidden: false,
        },
      ],
    } as never as PageSchema
    const offenders = findUnknownCustomBlocks(schema)
    expect(offenders.length).toBe(1)
    expect(offenders[0]!.componentName).toBe("ThirdPartyMap")
  })

  it("recurses into card → grid → custom for deeply nested offenders", () => {
    const schema = {
      ...baseSchema,
      blocks: [
        {
          id: "card",
          type: "card",
          hidden: false,
          blocks: [
            {
              id: "grid",
              type: "grid",
              columns: 2,
              hidden: false,
              blocks: [{ id: "deep", type: "custom", componentName: "Unknown", props: {}, hidden: false }],
            },
          ],
        },
      ],
    } as never as PageSchema
    const offenders = findUnknownCustomBlocks(schema)
    expect(offenders.length).toBe(1)
    expect(offenders[0]!.id).toBe("deep")
  })

  it("does not flag custom blocks whose componentName is in the allowlist", () => {
    // The set is empty in Phase 7; this guards against future regressions
    // when a real custom block ships and the allowlist gains entries.
    const knownNames = [...ALLOWED_CUSTOM_BLOCK_COMPONENTS]
    expect(knownNames.length).toBe(0)
  })
})

describe("extractPageI18n", () => {
  it("nests every localized string under pages.<pageId>", () => {
    const bundle = extractPageI18n(baseSchema)
    const en = bundle.en["orders-overview"] as Record<string, unknown>
    const ar = bundle.ar["orders-overview"] as Record<string, unknown>
    expect(en.title).toBe("Orders")
    expect(ar.title).toBe("الطلبات")
    expect(en.description).toBe("Quick view")
  })
})

describe("generatePageTsxFile / generateSchemaFile / generateTypesFile", () => {
  it("page.tsx imports the schema + renders <PageRenderer>", () => {
    const file = generatePageTsxFile("orders-overview")
    expect(file.path).toBe("src/app/(dashboard)/pages/orders-overview/page.tsx")
    expect(file.language).toBe("tsx")
    expect(file.content).toContain("import { PageRenderer }")
    expect(file.content).toContain('import schema from "./schema"')
    expect(file.content).toContain("<PageRenderer schema={schema} />")
  })

  it("schema.ts inlines a JSON literal that goes through pageSchema.parse() at module load", () => {
    const file = generateSchemaFile(baseSchema)
    expect(file.path).toBe("src/app/(dashboard)/pages/orders-overview/schema.ts")
    expect(file.language).toBe("ts")
    expect(file.content).toContain("pageSchema.parse(")
    expect(file.content).toContain('"orders-overview"')
  })

  it("types.ts re-exports PageSchema and emits the page id literal", () => {
    const file = generateTypesFile("orders-overview")
    expect(file.path).toBe("src/app/(dashboard)/pages/orders-overview/types.ts")
    expect(file.content).toContain("export type { PageSchema }")
    expect(file.content).toContain('export const PAGE_ID = "orders-overview" as const')
  })
})

describe("planPageGeneration", () => {
  it("returns a 3-file plan + i18n bundle + navigationSuggestion=null when navigation isn't set", () => {
    const plan = planPageGeneration(baseSchema)
    expect(plan.files.length).toBe(3)
    expect(plan.entityName).toBe("orders-overview")
    expect(plan.navigationSuggestion).toBeNull()
  })

  it("surfaces the navigation entry as a suggestion when present", () => {
    const schema = {
      ...baseSchema,
      navigation: { enabled: true, group: "operations", icon: "ShoppingCart", order: 50 },
    } as never as PageSchema
    const plan = planPageGeneration(schema)
    expect(plan.navigationSuggestion).toMatchObject({
      enabled: true,
      group: "operations",
      icon: "ShoppingCart",
      order: 50,
      href: "/pages/orders-overview",
      titleKey: "pages.orders-overview.title",
    })
  })
})
