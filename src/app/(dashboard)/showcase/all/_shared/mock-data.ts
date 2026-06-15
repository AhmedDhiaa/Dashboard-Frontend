/**
 * Mock-data constants shared across every Section in the mega-page. Keeping
 * all fixtures in one file means the table/widgets/forms all reference the
 * same canonical Iraqi-flavoured records — no drift between sections, no
 * inline `const mockOrders = [...]` scattered across files.
 *
 * Values are realistic for the Acme domain (Iraqi cities, +964 phones,
 * IQD currency, recent dates) but obviously fake — nothing here should
 * be mistaken for production data.
 */

import type { WidgetBuilderSchema } from "@/shared/widgets/schema"

// ─── Showcase sections (sticky-nav source of truth) ──────────────────────

export const SHOWCASE_SECTIONS = [
  { id: "primitives", label: "Primitives" },
  { id: "form-fields", label: "Form Fields" },
  { id: "form-layouts", label: "Form Layouts" },
  { id: "dynamic-list", label: "Dynamic List" },
  { id: "crud-views", label: "CRUD Views" },
  { id: "data-display", label: "Data Display" },
  { id: "data-table", label: "Data Table" },
  { id: "feedback", label: "Feedback" },
  { id: "skeletons", label: "Skeletons" },
  { id: "layout", label: "Layout" },
  { id: "application", label: "Application" },
  { id: "widgets", label: "Widgets" },
  { id: "map-tracking", label: "Maps & Tracking" },
] as const

// ─── People (avatars, customers, drivers) ────────────────────────────────

export const MOCK_PEOPLE = [
  { id: "p-1", name: "أحمد العامري", initials: "AA", phone: "+964 770 111 2233" },
  { id: "p-2", name: "فاطمة الموصلي", initials: "FM", phone: "+964 781 222 3344" },
  { id: "p-3", name: "محمد الكاظمي", initials: "MK", phone: "+964 791 333 4455" },
  { id: "p-4", name: "زينب الحلي", initials: "ZH", phone: "+964 750 444 5566" },
  { id: "p-5", name: "علي البصري", initials: "AB", phone: "+964 771 555 6677" },
] as const

// ─── Cities & countries (selects, autocompletes) ─────────────────────────

export const MOCK_CITIES = [
  { code: "bag", name: "بغداد" },
  { code: "bas", name: "البصرة" },
  { code: "mos", name: "الموصل" },
  { code: "erb", name: "أربيل" },
  { code: "naj", name: "النجف" },
  { code: "kar", name: "كربلاء" },
] as const

export const MOCK_COUNTRIES = [
  { code: "iq", name: "العراق" },
  { code: "sa", name: "السعودية" },
  { code: "kw", name: "الكويت" },
  { code: "jo", name: "الأردن" },
] as const

// ─── Orders (data table, widgets) ────────────────────────────────────────

export interface MockOrder {
  id: string
  code: string
  customer: string
  city: string
  phone: string
  total: number
  status: "new" | "in-progress" | "completed" | "cancelled"
  paid: boolean
  createdAt: string
}

export const MOCK_ORDERS: readonly MockOrder[] = [
  {
    id: "1",
    code: "ORD-100231",
    customer: "أحمد العامري",
    city: "بغداد",
    phone: "+964 770 111 2233",
    total: 245000,
    status: "new",
    paid: false,
    createdAt: "2026-05-10T09:14:00Z",
  },
  {
    id: "2",
    code: "ORD-100232",
    customer: "فاطمة الموصلي",
    city: "الموصل",
    phone: "+964 781 222 3344",
    total: 1820000,
    status: "in-progress",
    paid: false,
    createdAt: "2026-05-10T11:02:00Z",
  },
  {
    id: "3",
    code: "ORD-100233",
    customer: "محمد الكاظمي",
    city: "البصرة",
    phone: "+964 791 333 4455",
    total: 95000,
    status: "completed",
    paid: true,
    createdAt: "2026-05-09T16:48:00Z",
  },
  {
    id: "4",
    code: "ORD-100234",
    customer: "زينب الحلي",
    city: "كربلاء",
    phone: "+964 750 444 5566",
    total: 320000,
    status: "completed",
    paid: true,
    createdAt: "2026-05-09T08:22:00Z",
  },
  {
    id: "5",
    code: "ORD-100235",
    customer: "علي البصري",
    city: "البصرة",
    phone: "+964 771 555 6677",
    total: 750000,
    status: "in-progress",
    paid: false,
    createdAt: "2026-05-08T14:10:00Z",
  },
  {
    id: "6",
    code: "ORD-100236",
    customer: "نور الدليمي",
    city: "بغداد",
    phone: "+964 770 666 7788",
    total: 1100000,
    status: "cancelled",
    paid: false,
    createdAt: "2026-05-08T10:05:00Z",
  },
  {
    id: "7",
    code: "ORD-100237",
    customer: "حسن الأنباري",
    city: "أربيل",
    phone: "+964 750 777 8899",
    total: 480000,
    status: "new",
    paid: false,
    createdAt: "2026-05-07T18:36:00Z",
  },
  {
    id: "8",
    code: "ORD-100238",
    customer: "هدى الحسيني",
    city: "النجف",
    phone: "+964 781 888 9900",
    total: 215000,
    status: "completed",
    paid: true,
    createdAt: "2026-05-07T07:11:00Z",
  },
  {
    id: "9",
    code: "ORD-100239",
    customer: "كرار الطائي",
    city: "بغداد",
    phone: "+964 770 999 0011",
    total: 96000,
    status: "in-progress",
    paid: false,
    createdAt: "2026-05-06T15:50:00Z",
  },
  {
    id: "10",
    code: "ORD-100240",
    customer: "ريم الجبوري",
    city: "البصرة",
    phone: "+964 750 010 1122",
    total: 1450000,
    status: "completed",
    paid: true,
    createdAt: "2026-05-06T09:00:00Z",
  },
] as const

// ─── Stat-card values ────────────────────────────────────────────────────

export const MOCK_STATS = [
  { title: "Orders Today", value: 124, description: "+8 vs yesterday", trend: { value: 6.9, isPositive: true } },
  { title: "Revenue (IQD)", value: "12,480,000", description: "Last 7 days", trend: { value: 12.4, isPositive: true } },
  { title: "Active Drivers", value: 17, description: "of 28 enrolled" },
  { title: "Stalled Invoices", value: 3, description: "Awaiting collection", trend: { value: 2, isPositive: false } },
] as const

// ─── Widget mock data + schemas ──────────────────────────────────────────

export const MOCK_KPI_DATA = [{ revenue: 12_480_000, trend: 12.4 }]

export const MOCK_CHART_DATA = [
  { day: "Sat", orders: 18, revenue: 1_240_000 },
  { day: "Sun", orders: 24, revenue: 1_580_000 },
  { day: "Mon", orders: 22, revenue: 1_410_000 },
  { day: "Tue", orders: 31, revenue: 2_120_000 },
  { day: "Wed", orders: 28, revenue: 1_840_000 },
  { day: "Thu", orders: 35, revenue: 2_390_000 },
  { day: "Fri", orders: 19, revenue: 1_290_000 },
]

export const MOCK_ALERT_ROWS = [
  { message: "Tank #4 reading below 15% — schedule refill." },
  { message: "Driver أحمد العامري exceeded 12-hour shift cap." },
]

export const MOCK_MAP_ROWS = [
  { position: { lat: 33.3152, lng: 44.3661 }, label: "بغداد" },
  { position: { lat: 30.5085, lng: 47.7804 }, label: "البصرة" },
  { position: { lat: 36.345, lng: 43.145 }, label: "الموصل" },
]

export const MOCK_KPI_WIDGET: WidgetBuilderSchema = {
  id: "kpi-revenue",
  titleKey: "Revenue (IQD)",
  category: "kpi",
  dataSource: { type: "entity-list", entityName: "order" },
  visualization: { type: "kpi", valueField: "revenue", trendField: "trend", suffix: " IQD" },
  refresh: { mode: "manual" },
  layout: { w: 3, h: 2 },
  permissionKey: "Api.Order",
}

export const MOCK_TABLE_WIDGET: WidgetBuilderSchema = {
  id: "table-orders",
  titleKey: "Latest Orders",
  category: "table",
  dataSource: { type: "entity-list", entityName: "order" },
  visualization: {
    type: "table",
    pageSize: 5,
    columns: [
      { field: "code", label: { en: "Code", ar: "الكود" } },
      { field: "customer", label: { en: "Customer", ar: "العميل" } },
      { field: "total", label: { en: "Total", ar: "الإجمالي" }, align: "end", format: "number" },
      { field: "status", label: { en: "Status", ar: "الحالة" }, format: "badge" },
    ],
  },
  refresh: { mode: "manual" },
  layout: { w: 6, h: 3 },
  permissionKey: "Api.Order",
}

export const MOCK_ALERT_WIDGET: WidgetBuilderSchema = {
  id: "alert-fuel",
  titleKey: "Operational Alerts",
  category: "alert",
  dataSource: { type: "entity-list", entityName: "alert" },
  visualization: { type: "alert", severity: "warning", messageField: "message", hideWhenEmpty: true },
  refresh: { mode: "manual" },
  layout: { w: 4, h: 2 },
  permissionKey: "Api.Order",
}

export const MOCK_MAP_WIDGET: WidgetBuilderSchema = {
  id: "map-cities",
  titleKey: "Coverage",
  category: "map",
  dataSource: { type: "entity-list", entityName: "city" },
  visualization: { type: "map", positionField: "position", popupField: "label", defaultZoom: 6 },
  refresh: { mode: "manual" },
  layout: { w: 6, h: 4 },
  permissionKey: "Api.Order",
}
