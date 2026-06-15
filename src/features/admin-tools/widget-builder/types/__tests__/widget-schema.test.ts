import { describe, it, expect } from "vitest"
import { widgetBuilderSchema, WIDGET_CATEGORIES, type WidgetBuilderSchema } from "../widget-schema"
import { todaysOrdersKpi, revenueChart, recentCustomersTable } from "../examples"

describe("widgetBuilderSchema", () => {
  describe("round-trip", () => {
    it.each([
      ["KPI", todaysOrdersKpi],
      ["chart", revenueChart],
      ["table", recentCustomersTable],
    ])("%s example round-trips through JSON + parse", (_label, example) => {
      const direct = widgetBuilderSchema.parse(example)
      const reparsed = widgetBuilderSchema.parse(JSON.parse(JSON.stringify(example)))
      expect(reparsed).toEqual(direct)
    })
  })

  describe("category enum", () => {
    it("covers KPI cards, charts, tables, alerts, and maps", () => {
      expect(WIDGET_CATEGORIES).toEqual(["kpi", "chart", "table", "map", "alert"])
    })
  })

  describe("category vs visualization integrity", () => {
    it("rejects a kpi-category widget with a chart visualization", () => {
      const bad = { ...todaysOrdersKpi, visualization: revenueChart.visualization }
      const result = widgetBuilderSchema.safeParse(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.join(".") === "category")).toBe(true)
      }
    })
  })

  describe("color tokens", () => {
    it("rejects raw hex colors in chart series", () => {
      const bad: WidgetBuilderSchema = {
        ...revenueChart,
        visualization: {
          ...revenueChart.visualization,
          type: "chart",
          chartType: "bar",
          colors: ["#ff0000"],
          yAxes: [{ field: "x" }],
        } as never,
      }
      expect(widgetBuilderSchema.safeParse(bad).success).toBe(false)
    })

    it("accepts var(--token) colors", () => {
      const ok: WidgetBuilderSchema = {
        ...revenueChart,
        visualization: { ...revenueChart.visualization, colors: ["var(--primary)", "var(--accent)"] } as never,
      }
      expect(widgetBuilderSchema.safeParse(ok).success).toBe(true)
    })
  })

  describe("refresh policy", () => {
    it("rejects socket refresh on an entity-list source", () => {
      const bad = { ...todaysOrdersKpi, refresh: { mode: "socket" as const, topic: "orders" } }
      const result = widgetBuilderSchema.safeParse(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes("socket refresh"))).toBe(true)
      }
    })

    it("rejects sub-second intervals", () => {
      const bad = { ...todaysOrdersKpi, refresh: { mode: "interval" as const, intervalMs: 100 } }
      expect(widgetBuilderSchema.safeParse(bad).success).toBe(false)
    })
  })

  describe("layout bounds", () => {
    it("rejects width > 12 (12-col grid)", () => {
      const bad = { ...todaysOrdersKpi, layout: { w: 13, h: 2 } }
      expect(widgetBuilderSchema.safeParse(bad).success).toBe(false)
    })
  })

  describe("id format", () => {
    it("rejects PascalCase ids", () => {
      const bad = { ...todaysOrdersKpi, id: "TodaysOrders" }
      expect(widgetBuilderSchema.safeParse(bad).success).toBe(false)
    })
  })
})
