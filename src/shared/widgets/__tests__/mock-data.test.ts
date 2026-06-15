import { describe, it, expect } from "vitest"
import { mockDataForWidget } from "../mock-data"
import { todaysOrdersKpi, revenueChart, recentCustomersTable } from "../examples"
import type { WidgetBuilderSchema } from "../schema"

describe("mockDataForWidget", () => {
  it("returns a single row for KPI widgets, keyed by valueField", () => {
    const rows = mockDataForWidget(todaysOrdersKpi)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveProperty("count")
  })

  it("returns categorical rows for pie/donut charts", () => {
    const pie: WidgetBuilderSchema = {
      ...revenueChart,
      visualization: { ...revenueChart.visualization, chartType: "pie", showLegend: true } as never,
    }
    const rows = mockDataForWidget(pie)
    expect(rows.length).toBeGreaterThan(2)
    expect(rows[0]).toHaveProperty(revenueChart.visualization.type === "chart" ? "day" : "x")
  })

  it("returns up to pageSize rows for table widgets", () => {
    const rows = mockDataForWidget(recentCustomersTable)
    expect(rows.length).toBeLessThanOrEqual(
      recentCustomersTable.visualization.type === "table" ? recentCustomersTable.visualization.pageSize : 0,
    )
    expect(rows[0]).toHaveProperty("code")
  })

  it("populates the position field for map widgets", () => {
    const map: WidgetBuilderSchema = {
      ...todaysOrdersKpi,
      category: "map",
      visualization: { type: "map", positionField: "loc", popupField: "label", defaultZoom: 10 },
      layout: { w: 6, h: 4 },
    }
    const rows = mockDataForWidget(map)
    expect(rows.length).toBeGreaterThan(0)
    const first = rows[0]!
    expect(first).toHaveProperty("loc")
    expect((first.loc as { lat: number }).lat).toBeGreaterThan(0)
  })

  it("yields one alert row per message slot", () => {
    const alert: WidgetBuilderSchema = {
      ...todaysOrdersKpi,
      category: "alert",
      visualization: { type: "alert", severity: "warning", messageField: "msg", hideWhenEmpty: false },
    }
    const rows = mockDataForWidget(alert)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toHaveProperty("msg")
  })
})
