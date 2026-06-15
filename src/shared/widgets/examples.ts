import type { WidgetBuilderSchema } from "./schema"

/** "Today's Orders" KPI counting orders with status='new'. */
export const todaysOrdersKpi: WidgetBuilderSchema = {
  id: "todays-orders",
  titleKey: "dashboard.widgets.todays_orders",
  category: "kpi",
  dataSource: {
    type: "entity-list",
    entityName: "order",
    filter: { status: "new" },
    aggregateOp: "count",
  },
  visualization: {
    type: "kpi",
    valueField: "count",
    suffix: " orders",
    accentColor: "var(--primary)",
    icon: "ShoppingBag",
  },
  refresh: { mode: "interval", intervalMs: 30_000 },
  layout: { w: 3, h: 2 },
  permissionKey: "Api.Order",
}

/** Revenue trend bar chart sourced from a custom API. */
export const revenueChart: WidgetBuilderSchema = {
  id: "revenue-trend",
  titleKey: "dashboard.widgets.revenue_trend",
  category: "chart",
  dataSource: {
    type: "api-call",
    endpoint: "/api/app/reports/revenue-by-day",
    method: "GET",
    itemsPath: "items",
  },
  visualization: {
    type: "chart",
    chartType: "bar",
    xAxis: { field: "day", format: "date" },
    yAxes: [
      { field: "revenue", format: "currency", label: { en: "Revenue", ar: "الإيرادات" } },
      { field: "refunds", format: "currency", label: { en: "Refunds", ar: "المردودات" } },
    ],
    colors: ["var(--primary)", "var(--destructive)"],
    showLegend: true,
    stacked: false,
  },
  refresh: { mode: "manual" },
  layout: { w: 6, h: 4 },
  permissionKey: "Api.Reports",
}

/** Recent customers table. */
export const recentCustomersTable: WidgetBuilderSchema = {
  id: "recent-customers",
  titleKey: "dashboard.widgets.recent_customers",
  category: "table",
  dataSource: { type: "entity-list", entityName: "customer" },
  visualization: {
    type: "table",
    columns: [{ field: "code", format: "badge" }, { field: "name" }, { field: "isActive", format: "text" }],
    pageSize: 5,
  },
  refresh: { mode: "interval", intervalMs: 60_000 },
  layout: { w: 6, h: 3 },
  permissionKey: "Api.Customer",
}
