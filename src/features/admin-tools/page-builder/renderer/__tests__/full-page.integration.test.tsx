/**
 * Full-page integration test — Phase 3 deliverable.
 *
 * Builds a representative page schema that exercises the cross-section of
 * the runtime: page-level permission gate, layout frame, multiple
 * categories of blocks, and recursion (a card containing nested heading +
 * alert + a grid that itself contains buttons).
 *
 * Strategy:
 *   - The page schema is parsed through `pageSchema.parse(...)` first, so
 *     this test doubles as an end-to-end Phase 1 ↔ Phase 3 contract check.
 *     If the schema drifts, the parse fails before any rendering happens.
 *   - The mocked `usePermissionContext` (in setup.ts) treats the user as
 *     admin → page-level + block-level guards always pass.
 *   - We assert content from every category of block to confirm the
 *     registry dispatch + recursion both work end-to-end.
 *
 * What is NOT covered here:
 *   - actual data fetching for `table` / `kpi` / `chart` (Phase 4 wiring)
 *   - `dialog` / `drawer` action execution (Phase 4)
 *   - locale picking — Phase 3 always picks `.en`
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageRenderer } from "../PageRenderer"
import { pageSchema, type PageSchema } from "../../schema/page-schema"
// Side-effect: registers all 16 built-in blocks into blockRegistry.
import "../../registry/block-registry"

// Card / Button / StatCard consume useTheme(); short-circuit it.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// kpi/chart/detail/table blocks fetch via useBlockData; stub it so this
// integration test focuses on schema → block-tree composition rather
// than the live data-source plumbing.
vi.mock("@/features/admin-tools/page-builder/renderer/useBlockData", () => ({
  useBlockData: () => ({ data: { totalCount: 42, totalAmount: 1000 }, loading: false, error: null, refetch: () => {} }),
}))

// Build the schema as a plain JSON-serialisable object first, then validate.
const pageJson = {
  id: "orders-overview",
  version: "1.0",
  title: { en: "Orders overview", ar: "نظرة عامة" },
  description: { en: "Today's orders + key actions.", ar: "طلبات اليوم." },
  permission: "Api.Order",
  navigation: { enabled: true, group: "operations", icon: "ShoppingCart", order: 50 },
  layout: "centered",
  blocks: [
    {
      id: "page-heading",
      type: "heading",
      text: { en: "Welcome", ar: "أهلا" },
      level: 2,
    },
    {
      id: "intro-text",
      type: "text",
      text: { en: "Use the tabs below.", ar: "استخدم التبويبات." },
      variant: "lead",
    },
    {
      id: "main-divider",
      type: "divider",
    },
    {
      id: "warning-alert",
      type: "alert",
      severity: "warning",
      title: { en: "System maintenance tonight", ar: "صيانة الليلة" },
      message: { en: "Brief downtime expected.", ar: "توقف قصير." },
    },
    {
      id: "stats-card",
      type: "card",
      title: { en: "Today's stats", ar: "إحصائيات اليوم" },
      blocks: [
        {
          id: "stats-grid",
          type: "grid",
          columns: 2,
          blocks: [
            {
              id: "kpi-orders",
              type: "kpi",
              dataSource: { type: "entity", entityName: "order" },
              valueField: "totalCount",
              label: { en: "Orders", ar: "الطلبات" },
            },
            {
              id: "kpi-revenue",
              type: "kpi",
              dataSource: { type: "entity", entityName: "order" },
              valueField: "totalAmount",
              label: { en: "Revenue", ar: "الإيرادات" },
              prefix: "$",
            },
          ],
        },
      ],
    },
    {
      id: "actions-card",
      type: "card",
      title: { en: "Quick actions", ar: "إجراءات سريعة" },
      blocks: [
        {
          id: "btn-create-order",
          type: "button",
          button: {
            id: "create-order",
            label: { en: "Create order", ar: "إنشاء طلب" },
            position: "inline",
            variant: "default",
            action: { type: "navigate", href: "/orders/new" },
          },
        },
      ],
    },
  ],
} as const

describe("Full Page Builder render — orders-overview schema", () => {
  // Validate the schema once. If this fails, the rest of the suite is
  // pointless — bail with a clear message.
  const parsed: PageSchema = pageSchema.parse(pageJson)

  it("parses the schema cleanly through Phase 1 Zod schema", () => {
    expect(parsed.id).toBe("orders-overview")
    expect(parsed.blocks.length).toBe(6)
  })

  it("renders the page title (h1) and description", () => {
    render(<PageRenderer schema={parsed} />)
    expect(screen.getByRole("heading", { level: 1, name: "Orders overview" })).toBeInTheDocument()
    expect(screen.getByText("Today's orders + key actions.")).toBeInTheDocument()
  })

  it("renders top-level content blocks in order (heading + text)", () => {
    render(<PageRenderer schema={parsed} />)
    expect(screen.getByRole("heading", { level: 2, name: "Welcome" })).toBeInTheDocument()
    expect(screen.getByText("Use the tabs below.")).toBeInTheDocument()
  })

  it("renders the alert block with its ARIA role + title + message", () => {
    render(<PageRenderer schema={parsed} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("System maintenance tonight")).toBeInTheDocument()
    expect(screen.getByText("Brief downtime expected.")).toBeInTheDocument()
  })

  it("recurses into card → grid → kpi blocks (3 levels of nesting)", () => {
    render(<PageRenderer schema={parsed} />)
    // Both KPI labels surface inside the nested grid inside the card.
    expect(screen.getByText("Orders")).toBeInTheDocument()
    expect(screen.getByText("Revenue")).toBeInTheDocument()
  })

  it("recurses into card → button blocks", () => {
    render(<PageRenderer schema={parsed} />)
    expect(screen.getByRole("button", { name: /Create order/i })).toBeInTheDocument()
  })

  it("applies the layout frame class (centered)", () => {
    const { container } = render(<PageRenderer schema={parsed} />)
    const frame = container.querySelector('[data-page-id="orders-overview"]')
    expect(frame?.className).toMatch(/max-w-4xl/)
  })
})
