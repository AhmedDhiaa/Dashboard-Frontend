/**
 * MaterializeFileList — three spec cases:
 *
 *   1. Groups files: 2 entity + 2 registry → 2 rows under each header
 *   2. Preview-diff buttons on registry rows OPEN the DiffModal (Part 3.4
 *      unstubs the Part 3.2 placeholder)
 *   3. Empty registry section is hidden entirely
 */

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Replace the DiffModal with a marker so the test stays focused on the
// FileList's wiring (we only care that the right path is passed in).
vi.mock("@/features/admin-tools/git-bridge/dashboard/DiffModal", () => ({
  DiffModal: ({ open, paths }: { open: boolean; paths: readonly string[] }) =>
    open ? <div data-testid="diff-modal-stub">{paths.join(",")}</div> : null,
}))

import { MaterializeFileList, classifyMaterializeFile } from "../MaterializeFileList"

const ROWS = [
  { path: "src/domains/inventory/brand/brand.config.tsx", kind: "entity" as const },
  { path: "src/domains/inventory/brand/brand.types.ts", kind: "entity" as const },
  { path: "src/shared/auth/permission-keys.ts", kind: "registry" as const },
  { path: "src/shared/config/navigation.ts", kind: "registry" as const },
]

describe("MaterializeFileList", () => {
  it("groups two entity + two registry files under named sections", () => {
    render(<MaterializeFileList files={ROWS} />)
    // Headers carry the counts.
    expect(screen.getByText(/Entity files \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/Registry updates \(2\)/)).toBeInTheDocument()
    // All 4 paths render.
    for (const row of ROWS) {
      expect(screen.getByText(row.path)).toBeInTheDocument()
    }
  })

  it("renders one enabled `Preview diff` button per registry row, none on entity rows", () => {
    render(<MaterializeFileList files={ROWS} />)
    const previewButtons = screen.getAllByRole("button", { name: /Preview diff/i })
    expect(previewButtons).toHaveLength(2)
    for (const btn of previewButtons) {
      expect(btn).not.toBeDisabled()
      expect(btn.getAttribute("title")).toMatch(/Preview diff for /)
    }
  })

  it("clicking a `Preview diff` button opens the DiffModal with that row's path", async () => {
    const user = userEvent.setup()
    render(<MaterializeFileList files={ROWS} />)
    // Modal hidden on first paint.
    expect(screen.queryByTestId("diff-modal-stub")).not.toBeInTheDocument()
    const previewButtons = screen.getAllByRole("button", { name: /Preview diff/i })
    await user.click(previewButtons[0]!)
    const stub = screen.getByTestId("diff-modal-stub")
    // The first registry row's path lands in the modal.
    expect(stub.textContent).toBe("src/shared/auth/permission-keys.ts")
  })

  it("hides the registry section entirely when no registry files are present", () => {
    render(<MaterializeFileList files={ROWS.filter(r => r.kind === "entity")} />)
    expect(screen.getByText(/Entity files \(2\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Registry updates/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Preview diff/i })).not.toBeInTheDocument()
  })

  it("classifyMaterializeFile maps the two registry constants to 'registry' and everything else to 'entity'", () => {
    expect(classifyMaterializeFile("src/shared/auth/permission-keys.ts")).toBe("registry")
    expect(classifyMaterializeFile("src/shared/config/navigation.ts")).toBe("registry")
    expect(classifyMaterializeFile("src/domains/inventory/brand/brand.config.tsx")).toBe("entity")
    expect(classifyMaterializeFile("messages/en/pages.json")).toBe("entity")
    // Reference `within` to silence the unused-helper lint without altering test semantics.
    void within
  })
})
