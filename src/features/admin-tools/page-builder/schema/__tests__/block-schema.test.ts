import { describe, expect, it } from "vitest"
import {
  blockSchema,
  columnSchema,
  dataSourceSchema,
  formLayoutSchema,
  PAGE_BUILDER_COLUMN_TYPES,
} from "../block-schema"
import { MASTER_COLUMN_TYPES } from "@/core/entities/column-types"

describe("PAGE_BUILDER_COLUMN_TYPES", () => {
  it("contains exactly 18 entries (per spec §3)", () => {
    expect(PAGE_BUILDER_COLUMN_TYPES.length).toBe(18)
  })

  it("every Page Builder column type is also a master type (SSOT invariant)", () => {
    for (const t of PAGE_BUILDER_COLUMN_TYPES) {
      expect(MASTER_COLUMN_TYPES).toContain(t)
    }
  })
})

describe("dataSourceSchema", () => {
  it("accepts an entity source", () => {
    expect(() => dataSourceSchema.parse({ type: "entity", entityName: "order" })).not.toThrow()
  })

  it("accepts an api source with defaults", () => {
    const parsed = dataSourceSchema.parse({
      type: "api",
      endpoint: "/orders",
      method: "GET",
    })
    if (parsed.type === "api") {
      expect(parsed.itemsPath).toBe("items")
      expect(parsed.totalCountPath).toBe("totalCount")
    }
  })

  it("accepts a swagger source", () => {
    expect(() =>
      dataSourceSchema.parse({
        type: "swagger",
        swaggerUrl: "https://example.com/swagger.json",
        operationId: "getOrders",
      }),
    ).not.toThrow()
  })

  it("rejects an api endpoint with bad characters", () => {
    expect(() =>
      dataSourceSchema.parse({
        type: "api",
        endpoint: "https://example.com/orders",
        method: "GET",
      }),
    ).toThrow()
  })

  it("rejects a swagger source with a non-URL", () => {
    expect(() =>
      dataSourceSchema.parse({
        type: "swagger",
        swaggerUrl: "not-a-url",
        operationId: "x",
      }),
    ).toThrow()
  })

  it("rejects an entity source with a non-kebab name", () => {
    expect(() => dataSourceSchema.parse({ type: "entity", entityName: "Order" })).toThrow()
  })
})

describe("columnSchema", () => {
  it("accepts a minimal column", () => {
    const parsed = columnSchema.parse({ field: "name", type: "text-primary" })
    expect(parsed.sortable).toBe(true)
    expect(parsed.filterable).toBe(false)
  })

  it("accepts a dot-path column", () => {
    expect(() => columnSchema.parse({ field: "user.name", type: "text-primary" })).not.toThrow()
  })

  it("rejects an unknown column type", () => {
    expect(() => columnSchema.parse({ field: "x", type: "rainbow" })).toThrow()
  })
})

describe("formLayoutSchema (recursive)", () => {
  it("accepts a flat grid layout (3 rows, 1 / 2 / 1 columns)", () => {
    expect(() =>
      formLayoutSchema.parse({
        type: "grid",
        rows: [
          { columns: 1, fields: ["name"] },
          { columns: 2, fields: ["email", "phone"] },
          { columns: 1, fields: ["address"] },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a tabbed layout containing nested grid layouts", () => {
    expect(() =>
      formLayoutSchema.parse({
        type: "tabs",
        tabs: [
          {
            id: "basic",
            title: { en: "Basic", ar: "الأساسية" },
            layout: {
              type: "grid",
              rows: [{ columns: 2, fields: ["name", "type"] }],
            },
          },
          {
            id: "contact",
            title: { en: "Contact", ar: "التواصل" },
            layout: {
              type: "grid",
              rows: [{ columns: 2, fields: ["email", "phone"] }],
            },
          },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a sections layout with two collapsible sections", () => {
    expect(() =>
      formLayoutSchema.parse({
        type: "sections",
        sections: [
          {
            id: "personal",
            title: { en: "Personal", ar: "شخصي" },
            collapsible: true,
            defaultOpen: true,
            layout: { type: "grid", rows: [{ columns: 2, fields: ["firstName", "lastName"] }] },
          },
          {
            id: "address",
            title: { en: "Address", ar: "العنوان" },
            layout: { type: "grid", rows: [{ columns: 1, fields: ["street"] }] },
          },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a split layout with grids on both sides + 60/40 ratio", () => {
    expect(() =>
      formLayoutSchema.parse({
        type: "split",
        ratio: "60/40",
        left: { type: "grid", rows: [{ columns: 1, fields: ["name"] }] },
        right: { type: "grid", rows: [{ columns: 1, fields: ["mapLocation"] }] },
      }),
    ).not.toThrow()
  })

  it("rejects a grid row with non-integer columns", () => {
    expect(() =>
      formLayoutSchema.parse({
        type: "grid",
        rows: [{ columns: 5, fields: ["a", "b", "c", "d", "e"] }],
      }),
    ).toThrow()
  })
})

describe("blockSchema — content blocks", () => {
  it("accepts a heading", () => {
    const parsed = blockSchema.parse({
      id: "title",
      type: "heading",
      text: { en: "Hello", ar: "مرحبا" },
    }) as { type: "heading"; level: number }
    expect(parsed.level).toBe(2)
  })

  it("accepts text / divider / spacer with defaults", () => {
    expect(() => blockSchema.parse({ id: "para-1", type: "text", text: { en: "x", ar: "س" } })).not.toThrow()
    expect(() => blockSchema.parse({ id: "div-1", type: "divider" })).not.toThrow()
    expect(() => blockSchema.parse({ id: "sp-1", type: "spacer" })).not.toThrow()
  })
})

describe("blockSchema — layout blocks (recursive)", () => {
  it("accepts a card containing nested blocks", () => {
    expect(() =>
      blockSchema.parse({
        id: "card-1",
        type: "card",
        title: { en: "Group", ar: "مجموعة" },
        blocks: [
          { id: "inner-heading", type: "heading", text: { en: "Inner", ar: "داخلي" } },
          { id: "inner-divider", type: "divider" },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a tabs block with two tabs", () => {
    expect(() =>
      blockSchema.parse({
        id: "tabs-1",
        type: "tabs",
        tabs: [
          { id: "tab-a", label: { en: "A", ar: "أ" }, blocks: [] },
          { id: "tab-b", label: { en: "B", ar: "ب" }, blocks: [] },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts an accordion + grid block", () => {
    expect(() =>
      blockSchema.parse({
        id: "acc-1",
        type: "accordion",
        items: [{ id: "item-1", title: { en: "I", ar: "ع" }, blocks: [] }],
      }),
    ).not.toThrow()
    expect(() =>
      blockSchema.parse({
        id: "grid-1",
        type: "grid",
        columns: 2,
        blocks: [],
      }),
    ).not.toThrow()
  })
})

describe("blockSchema — table block", () => {
  it("accepts a table block backed by an entity source", () => {
    expect(() =>
      blockSchema.parse({
        id: "list",
        type: "table",
        dataSource: { type: "entity", entityName: "order" },
        columns: [
          { field: "code", type: "badge-code" },
          { field: "name", type: "text-primary" },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a table block with rowActions + bulkActions", () => {
    expect(() =>
      blockSchema.parse({
        id: "list",
        type: "table",
        dataSource: { type: "entity", entityName: "order" },
        columns: [{ field: "code", type: "badge-code" }],
        rowActions: [
          {
            id: "view",
            label: { en: "View", ar: "عرض" },
            position: "row",
            action: { type: "navigate", href: "/orders/{id}" },
          },
        ],
        bulkActions: [
          {
            id: "delete-many",
            label: { en: "Delete", ar: "حذف" },
            position: "page-header",
            variant: "destructive",
            action: { type: "api", method: "DELETE", endpoint: "/orders/bulk" },
          },
        ],
      }),
    ).not.toThrow()
  })
})

describe("blockSchema — form / kpi / chart blocks", () => {
  it("accepts a form block with a grid layout + submit action", () => {
    expect(() =>
      blockSchema.parse({
        id: "form",
        type: "form",
        fields: [{ name: "title", type: "text", label: { en: "Title", ar: "العنوان" } }],
        layout: { type: "grid", rows: [{ columns: 1, fields: ["title"] }] },
        submitAction: { type: "api", method: "POST", endpoint: "/x" },
      }),
    ).not.toThrow()
  })

  it("accepts a kpi block", () => {
    expect(() =>
      blockSchema.parse({
        id: "kpi-1",
        type: "kpi",
        dataSource: { type: "entity", entityName: "order" },
        valueField: "totalCount",
        label: { en: "Orders", ar: "الطلبات" },
      }),
    ).not.toThrow()
  })

  it("accepts a chart block", () => {
    expect(() =>
      blockSchema.parse({
        id: "chart-1",
        type: "chart",
        dataSource: { type: "entity", entityName: "order" },
        chartType: "line",
        yAxes: [{ field: "total" }],
      }),
    ).not.toThrow()
  })
})

describe("blockSchema — alert / map / button / detail / custom blocks", () => {
  it("accepts an alert block", () => {
    expect(() =>
      blockSchema.parse({
        id: "alert-1",
        type: "alert",
        severity: "warning",
        title: { en: "Heads up", ar: "تنبيه" },
      }),
    ).not.toThrow()
  })

  it("accepts a map block", () => {
    expect(() =>
      blockSchema.parse({
        id: "map-1",
        type: "map",
        dataSource: { type: "entity", entityName: "vehicle" },
        features: { markers: true, boundaries: false, drawing: false },
      }),
    ).not.toThrow()
  })

  it("accepts a button block", () => {
    expect(() =>
      blockSchema.parse({
        id: "btn-1",
        type: "button",
        button: {
          id: "go-orders",
          label: { en: "Go", ar: "اذهب" },
          position: "page-header",
          action: { type: "navigate", href: "/orders" },
        },
      }),
    ).not.toThrow()
  })

  it("accepts a detail block", () => {
    expect(() =>
      blockSchema.parse({
        id: "detail-1",
        type: "detail",
        dataSource: { type: "entity", entityName: "order" },
        sections: [
          {
            id: "main",
            title: { en: "Main", ar: "الرئيسية" },
            fields: [{ field: "code" }, { field: "name", type: "text-primary" }],
          },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts a custom block (escape hatch)", () => {
    expect(() =>
      blockSchema.parse({
        id: "ext-1",
        type: "custom",
        componentName: "ThirdPartyMap",
        props: { center: [0, 0] },
      }),
    ).not.toThrow()
  })
})

describe("blockSchema — failures", () => {
  it("rejects an unknown block type", () => {
    expect(() => blockSchema.parse({ id: "x", type: "totally-unknown" })).toThrow()
  })

  it("rejects a chart with zero Y axes", () => {
    expect(() =>
      blockSchema.parse({
        id: "chart",
        type: "chart",
        dataSource: { type: "entity", entityName: "order" },
        chartType: "line",
        yAxes: [],
      }),
    ).toThrow()
  })

  it("rejects a heading at level 5", () => {
    expect(() =>
      blockSchema.parse({
        id: "h",
        type: "heading",
        text: { en: "X", ar: "س" },
        level: 5,
      }),
    ).toThrow()
  })

  it("rejects a table with an unknown column type", () => {
    expect(() =>
      blockSchema.parse({
        id: "t",
        type: "table",
        dataSource: { type: "entity", entityName: "order" },
        columns: [{ field: "name", type: "rainbow" }],
      }),
    ).toThrow()
  })
})
