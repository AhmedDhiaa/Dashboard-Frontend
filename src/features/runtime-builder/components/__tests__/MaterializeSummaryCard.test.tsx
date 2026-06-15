/**
 * MaterializeSummaryCard — five spec cases:
 *
 *   1. Renders all 4 controls with default values when entity has no nav block
 *   2. Renders with persisted values when navigation block is present
 *   3. "Reset to defaults" snaps everything back via onChange
 *   4. Icon list contains exactly the 20 curated names (and only those)
 *   5. Permission-key default = Api.<Pascal(id)> — incl. multi-word kebab
 */

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { MaterializeSummaryCard, computeDefaults, type MaterializeSummaryValue } from "../MaterializeSummaryCard"
import { MATERIALIZE_ICON_NAMES, kebabToPascal } from "../materialize-icons"

const NAV_OPTIONS = ["nav.master_data", "nav.system", "nav.fleet"] as const

function setup(opts: { value?: MaterializeSummaryValue; entityNameKebab?: string } = {}) {
  const onChange = vi.fn()
  const entityNameKebab = opts.entityNameKebab ?? "brand"
  const value = opts.value ?? computeDefaults(entityNameKebab, NAV_OPTIONS)
  render(
    <MaterializeSummaryCard
      value={value}
      onChange={onChange}
      entityNamePlural="brands"
      entityNameKebab={entityNameKebab}
      navGroupOptions={NAV_OPTIONS}
    />,
  )
  return { onChange, value, entityNameKebab }
}

describe("MaterializeSummaryCard", () => {
  it("renders all 4 controls with default values when entity has no nav block", () => {
    setup()
    // Label assertions verify the 4 sections exist.
    expect(screen.getByText("Sidebar group")).toBeInTheDocument()
    expect(screen.getByText("Position")).toBeInTheDocument()
    expect(screen.getByText("Sidebar icon")).toBeInTheDocument()
    expect(screen.getByText("Permission key")).toBeInTheDocument()
    // Permission-key input shows the computed default.
    const permInput = screen.getByLabelText(/Permission key/i) as HTMLInputElement
    expect(permInput.value).toBe("Api.Brand")
    // Order input default.
    const orderInput = screen.getByLabelText(/Position/i) as HTMLInputElement
    expect(orderInput.value).toBe("99")
  })

  it("renders with persisted values when navigation block is present", () => {
    setup({
      value: { group: "nav.fleet", order: 5, icon: "Truck", permissionKey: "Api.Custom.Manage" },
    })
    expect((screen.getByLabelText(/Permission key/i) as HTMLInputElement).value).toBe("Api.Custom.Manage")
    expect((screen.getByLabelText(/Position/i) as HTMLInputElement).value).toBe("5")
  })

  it("`Reset to defaults` fires onChange with computed defaults", async () => {
    const user = userEvent.setup()
    const { onChange } = setup({
      value: { group: "nav.fleet", order: 5, icon: "Truck", permissionKey: "Api.Other.Foo" },
    })
    await user.click(screen.getByTestId("reset-defaults"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as MaterializeSummaryValue
    expect(next).toEqual(computeDefaults("brand", NAV_OPTIONS))
    expect(next.permissionKey).toBe("Api.Brand")
    expect(next.order).toBe(99)
    expect(next.icon).toBe("Box")
    expect(next.group).toBe(NAV_OPTIONS[0])
  })

  it("the curated icon list has exactly 20 entries with the spec'd names (and only those)", () => {
    // The curated list is the bundle guard; surface drift in the count.
    expect(MATERIALIZE_ICON_NAMES).toHaveLength(20)
    const expected = [
      "Box",
      "Users",
      "Package",
      "Settings",
      "Truck",
      "ShoppingCart",
      "Database",
      "FileText",
      "BarChart",
      "MapPin",
      "DollarSign",
      "ClipboardList",
      "Globe",
      "Layers",
      "Shield",
      "Bell",
      "Star",
      "Tag",
      "Briefcase",
      "Calendar",
    ]
    expect([...MATERIALIZE_ICON_NAMES].sort()).toEqual([...expected].sort())
  })

  it("permission-key default for multi-word kebab id is Api.<Pascal(id)>", () => {
    expect(kebabToPascal("purchase-invoice")).toBe("PurchaseInvoice")
    setup({ entityNameKebab: "purchase-invoice" })
    expect((screen.getByLabelText(/Permission key/i) as HTMLInputElement).value).toBe("Api.PurchaseInvoice")
  })

  it("typing in the permission-key input fires onChange with the typed value", async () => {
    const user = userEvent.setup()
    const { onChange } = setup()
    const input = screen.getByLabelText(/Permission key/i)
    // Controlled component: each keystroke fires onChange with the
    // expected NEW value (current value + typed char). Asserting on the
    // last call value avoids depending on the parent's state-update
    // round-trip.
    await user.type(input, "X")
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls.at(-1)?.[0] as MaterializeSummaryValue | undefined
    expect(lastCall?.permissionKey).toMatch(/X$/)
    void within
  })
})
