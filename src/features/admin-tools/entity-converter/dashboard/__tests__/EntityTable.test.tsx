/**
 * EntityTable renders three row shapes; this pins each shape's
 * visible markers (badge text, action element, refusal tooltip).
 *
 * The table is a Server Component, but React's testing surface
 * renders the JSX it returns directly — the only piece that
 * actually hydrates is <EditFieldsButton>, which we mock so the
 * test stays focused on the table.
 */

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Replace the client island with a marker so the table test doesn't
// pull in dialog primitives, the Server Action import chain, etc.
vi.mock("../EditFieldsButton", () => ({
  EditFieldsButton: ({ entityName }: { entityName: string }) => (
    <button data-testid={`edit-fields-${entityName}`}>Edit fields</button>
  ),
}))

// Match the page-builder test convention: short-circuit ThemeManager so
// design-system primitives (Button) don't error on the missing provider.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { EntityTable, type EntityTableRow } from "../EntityTable"

const SAMPLE_ROWS: EntityTableRow[] = [
  {
    id: "brand",
    displayName: "Brand",
    source: "static",
    parse: { ok: true, entity: { id: "brand" } as never, sourcePaths: [], staticBlob: {} },
  },
  {
    id: "order",
    displayName: "Order",
    source: "static",
    parse: { ok: false, reason: "Uses external renderers", filePath: "src/domains/business/order/order.config.tsx" },
    absoluteSourcePath: "/abs/path/src/domains/business/order/order.config.tsx",
  },
  {
    id: "custom-thing",
    displayName: "Custom Thing",
    source: "runtime",
  },
]

describe("EntityTable", () => {
  it("renders the convertible-static row with the convert button and info badge", () => {
    render(
      <EntityTable
        rows={SAMPLE_ROWS}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    expect(screen.getByText("Brand")).toBeInTheDocument()
    expect(screen.getByText("Convertible from UI")).toBeInTheDocument()
    expect(screen.getByTestId("edit-fields-brand")).toBeInTheDocument()
  })

  it("renders the refused-static row with a Source-only badge whose `title` carries the reason", () => {
    render(
      <EntityTable
        rows={SAMPLE_ROWS}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    const badge = screen.getByText("Source-only")
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute("title")).toBe("Uses external renderers")
    // Action: "Open in editor" anchor pointing at vscode://file/<abs>
    const link = screen.getByText("Open in editor") as HTMLAnchorElement
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toMatch(/^vscode:\/\/file\//)
    expect(link.getAttribute("href")).toContain("order.config.tsx")
  })

  it("renders the runtime row with an Editable badge and an /builder?entity=... link", () => {
    render(
      <EntityTable
        rows={SAMPLE_ROWS}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    expect(screen.getByText("Custom Thing")).toBeInTheDocument()
    expect(screen.getByText("Editable")).toBeInTheDocument()
    const editLink = screen.getByText("Edit") as HTMLAnchorElement
    expect(editLink.getAttribute("href")).toBe("/builder?entity=custom-thing")
  })

  it("renders Create new + header counts", () => {
    render(
      <EntityTable
        rows={SAMPLE_ROWS}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    const create = screen.getByText(/Create new/i) as HTMLAnchorElement
    expect(create.closest("a")?.getAttribute("href")).toBe("/builder")
    // Header summary: "3 total — 1 runtime, 2 static"
    expect(screen.getByText(/3 total/)).toBeInTheDocument()
    expect(screen.getByText(/1 runtime/)).toBeInTheDocument()
    expect(screen.getByText(/2 static/)).toBeInTheDocument()
  })

  it("renders the empty state when no rows are passed", () => {
    render(
      <EntityTable rows={[]} convertAction={async () => ({ ok: true })} restoreAction={async () => ({ ok: true })} />,
    )
    expect(screen.getByText(/No entities registered yet/)).toBeInTheDocument()
    // The header still renders, just with zero totals.
    expect(screen.getByText(/0 total/)).toBeInTheDocument()
  })

  it("does not render an Edit fields button on a refused row", () => {
    render(
      <EntityTable
        rows={SAMPLE_ROWS}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    expect(screen.queryByTestId("edit-fields-order")).not.toBeInTheDocument()
    // And the runtime row also does not surface the convert button.
    expect(screen.queryByTestId("edit-fields-custom-thing")).not.toBeInTheDocument()
  })

  it("uses an alphabetical key per row so re-renders are stable", () => {
    // Sanity check: the component does NOT sort rows itself (the page
    // does, before passing them in). Order in props = order in DOM.
    const { container } = render(
      <EntityTable
        rows={[SAMPLE_ROWS[2]!, SAMPLE_ROWS[0]!]}
        convertAction={async () => ({ ok: true })}
        restoreAction={async () => ({ ok: true })}
      />,
    )
    const rows = within(container).getAllByRole("row")
    // First row is the header, then the two data rows in props order.
    expect(rows).toHaveLength(3)
    expect(rows[1]?.textContent).toContain("Custom Thing")
    expect(rows[2]?.textContent).toContain("Brand")
  })
})
