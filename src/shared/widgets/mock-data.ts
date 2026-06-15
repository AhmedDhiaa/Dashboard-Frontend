/**
 * Deterministic mock-data generator for widget previews. Driven entirely
 * off the widget's visualization config so previews stay representative
 * even as admins edit fields on the fly. Pure function — no I/O.
 */

import type { WidgetBuilderSchema } from "@/shared/widgets/schema"

export function mockDataForWidget(schema: WidgetBuilderSchema): Record<string, unknown>[] {
  const v = schema.visualization

  if (v.type === "kpi") {
    const row: Record<string, unknown> = { [v.valueField || "value"]: 1234 }
    if (v.trendField) row[v.trendField] = 12.5
    return [row]
  }

  if (v.type === "chart") {
    const xField = v.xAxis?.field ?? "x"
    const isCategorical = v.chartType === "pie" || v.chartType === "donut"
    const labels = isCategorical
      ? ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return labels.map((label, i) => {
      const row: Record<string, unknown> = { [xField]: label }
      v.yAxes.forEach((y, j) => {
        row[y.field || `y${j}`] = Math.round(50 + 50 * Math.sin((i + j) * 0.7) + j * 25 + i * 5)
      })
      return row
    })
  }

  if (v.type === "table") {
    return Array.from({ length: Math.min(5, v.pageSize) }, (_, i) => {
      const row: Record<string, unknown> = {}
      v.columns.forEach((c, j) => {
        switch (c.format) {
          case "number":
            row[c.field || `col${j}`] = (i + 1) * 100
            break
          case "currency":
            row[c.field || `col${j}`] = (i + 1) * 1234
            break
          case "date":
            row[c.field || `col${j}`] = new Date(Date.now() - i * 86_400_000).toISOString()
            break
          case "badge":
            row[c.field || `col${j}`] = ["new", "active", "pending"][i % 3]
            break
          default:
            row[c.field || `col${j}`] = `Sample ${i + 1}`
        }
      })
      return row
    })
  }

  if (v.type === "alert") {
    return Array.from({ length: 3 }, (_, i) => ({ [v.messageField]: `Sample alert ${i + 1}` }))
  }

  if (v.type === "map") {
    return Array.from({ length: 4 }, (_, i) => ({
      [v.positionField]: { lat: 24.7 + i * 0.01, lng: 46.7 + i * 0.01 },
      ...(v.popupField ? { [v.popupField]: `Marker ${i + 1}` } : {}),
    }))
  }

  return []
}
