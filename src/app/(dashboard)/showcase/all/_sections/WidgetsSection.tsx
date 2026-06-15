"use client"

/**
 * WidgetsSection — WidgetRenderer one example per category.
 *
 * Covered: kpi, table, chart (chart shown via the same renderer; recharts
 * loads dynamically), alert, map. The map widget renders WidgetRenderer's
 * built-in static placeholder body (marker count + zoom level) — it does
 * NOT call @googlemaps/js-api-loader. Per the brief, the real Google Maps
 * loader is intentionally not exercised here.
 */

import { WidgetRenderer } from "@/shared/widgets/WidgetRenderer"
import type { WidgetBuilderSchema } from "@/shared/widgets/schema"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import {
  MOCK_ALERT_ROWS,
  MOCK_ALERT_WIDGET,
  MOCK_CHART_DATA,
  MOCK_KPI_DATA,
  MOCK_KPI_WIDGET,
  MOCK_MAP_ROWS,
  MOCK_MAP_WIDGET,
  MOCK_ORDERS,
  MOCK_TABLE_WIDGET,
} from "../_shared/mock-data"

const CHART_WIDGET: WidgetBuilderSchema = {
  id: "chart-orders",
  titleKey: "Orders per day",
  category: "chart",
  dataSource: { type: "entity-list", entityName: "order" },
  visualization: {
    type: "chart",
    chartType: "line",
    xAxis: { field: "day" },
    yAxes: [{ field: "orders", label: { en: "Orders", ar: "الطلبات" } }],
    showLegend: true,
    stacked: false,
  },
  refresh: { mode: "manual" },
  layout: { w: 6, h: 3 },
  permissionKey: "Api.Order",
}

export default function WidgetsSection() {
  return (
    <div className="space-y-6">
      <ShowcaseBlock
        title="WidgetRenderer — KPI"
        description="Big-number metric with optional prefix/suffix and trend."
      >
        <div className="h-32">
          <WidgetRenderer schema={MOCK_KPI_WIDGET} data={MOCK_KPI_DATA} />
        </div>
      </ShowcaseBlock>
      <ShowcaseBlock
        title="WidgetRenderer — Chart"
        description="Recharts-powered line chart (recharts loads dynamically)."
      >
        <div className="h-64">
          <WidgetRenderer schema={CHART_WIDGET} data={MOCK_CHART_DATA} />
        </div>
      </ShowcaseBlock>
      <ShowcaseBlock
        title="WidgetRenderer — Table"
        description="Top-N rows from the entity source with per-column formatting."
      >
        <div className="h-72">
          <WidgetRenderer schema={MOCK_TABLE_WIDGET} data={MOCK_ORDERS as unknown as Record<string, unknown>[]} />
        </div>
      </ShowcaseBlock>
      <ShowcaseBlock title="WidgetRenderer — Alert" description="List of operational alert lines bound to a severity.">
        <div className="h-40">
          <WidgetRenderer schema={MOCK_ALERT_WIDGET} data={MOCK_ALERT_ROWS} />
        </div>
      </ShowcaseBlock>
      <ShowcaseBlock
        title="WidgetRenderer — Map"
        description="Static placeholder body (the real map ships with @googlemaps/js-api-loader and is intentionally not loaded here)."
      >
        <div className="h-64">
          <WidgetRenderer schema={MOCK_MAP_WIDGET} data={MOCK_MAP_ROWS} />
        </div>
      </ShowcaseBlock>
    </div>
  )
}
