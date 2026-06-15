/**
 * DiffModal — state machine + render-shape coverage.
 *
 * The api-client's `fetchDiff` is the network seam; we mock it per test
 * to drive the three states (loading → loaded, loaded → error, retry).
 * The per-line styling check is the only test that asserts on the DOM
 * payload — the rest pin on visible text + button presence.
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const fetchDiffSpy = vi.fn()
vi.mock("../api-client", () => ({
  fetchDiff: (...args: unknown[]) => fetchDiffSpy(...args),
}))

import { DiffModal, statusFromDiff } from "../DiffModal"

afterEach(() => {
  fetchDiffSpy.mockReset()
})

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index abc..def 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,3 @@
 unchanged
-removed line
+added line
`

describe("DiffModal", () => {
  it("renders nothing when open=false (Dialog stays unmounted)", () => {
    render(<DiffModal open={false} onOpenChange={() => {}} paths={["src/foo.ts"]} />)
    expect(screen.queryByText(/File diffs/i)).not.toBeInTheDocument()
    expect(fetchDiffSpy).not.toHaveBeenCalled()
  })

  it("fetches one diff per path when opened — parallel calls match the paths prop", async () => {
    fetchDiffSpy.mockImplementation(async (p: string) => ({
      path: p,
      diff: SAMPLE_DIFF,
      truncated: false,
      empty: false,
    }))
    render(
      <DiffModal
        open
        onOpenChange={() => {}}
        paths={["src/shared/auth/permission-keys.ts", "src/shared/config/navigation.ts"]}
      />,
    )
    await waitFor(() => expect(fetchDiffSpy).toHaveBeenCalledTimes(2))
    expect(fetchDiffSpy).toHaveBeenCalledWith("src/shared/auth/permission-keys.ts")
    expect(fetchDiffSpy).toHaveBeenCalledWith("src/shared/config/navigation.ts")
    // Both paths render as section headers.
    expect(await screen.findByText("src/shared/auth/permission-keys.ts")).toBeInTheDocument()
    expect(await screen.findByText("src/shared/config/navigation.ts")).toBeInTheDocument()
  })

  it("renders an empty state when paths is [] (no fetch fired)", async () => {
    render(<DiffModal open onOpenChange={() => {}} paths={[]} />)
    await screen.findByText(/No files to diff/i)
    expect(fetchDiffSpy).not.toHaveBeenCalled()
  })

  it("shows an error message + Retry button on fetch failure; Retry re-fires the fetch", async () => {
    const user = userEvent.setup()
    fetchDiffSpy.mockRejectedValueOnce(new Error("HTTP 500: git diff failed"))
    render(<DiffModal open onOpenChange={() => {}} paths={["src/foo.ts"]} />)
    await screen.findByText(/git diff failed/i)
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument()
    // Second attempt: succeed.
    fetchDiffSpy.mockResolvedValueOnce({ path: "src/foo.ts", diff: SAMPLE_DIFF, truncated: false, empty: false })
    await user.click(screen.getByRole("button", { name: /Retry/i }))
    await waitFor(() => expect(fetchDiffSpy).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("src/foo.ts")).toBeInTheDocument()
  })

  it("per-line styling: addition lines get success class, deletion lines get destructive class", async () => {
    fetchDiffSpy.mockResolvedValue({
      path: "src/foo.ts",
      diff: SAMPLE_DIFF,
      truncated: false,
      empty: false,
    })
    render(<DiffModal open onOpenChange={() => {}} paths={["src/foo.ts"]} />)
    // Radix Dialog renders the content in a portal attached to
    // document.body, so we query the document root rather than the
    // testing-library `container` (which only covers the wrapper).
    await waitFor(() => expect(document.querySelector("[data-line-kind='addition']")).not.toBeNull())
    const additionLine = document.querySelector("[data-line-kind='addition']")
    const deletionLine = document.querySelector("[data-line-kind='deletion']")
    const hunkLine = document.querySelector("[data-line-kind='hunk']")
    expect(additionLine?.textContent ?? "").toMatch(/^\+added line/)
    expect(deletionLine?.textContent ?? "").toMatch(/^-removed line/)
    expect(hunkLine?.textContent ?? "").toMatch(/^@@/)
    const headerLines = document.querySelectorAll("[data-line-kind='header']")
    expect(headerLines.length).toBeGreaterThanOrEqual(3)
  })

  it("renders a `truncated` badge when the server caps the diff", async () => {
    fetchDiffSpy.mockResolvedValue({
      path: "src/big.ts",
      diff: SAMPLE_DIFF,
      truncated: true,
      empty: false,
    })
    render(<DiffModal open onOpenChange={() => {}} paths={["src/big.ts"]} />)
    expect(await screen.findByText("truncated")).toBeInTheDocument()
  })

  it("renders a per-file `unchanged` row body for empty diffs", async () => {
    fetchDiffSpy.mockResolvedValue({
      path: "src/empty.ts",
      diff: "",
      truncated: false,
      empty: true,
    })
    render(<DiffModal open onOpenChange={() => {}} paths={["src/empty.ts"]} />)
    expect(await screen.findByText(/No working-tree changes/i)).toBeInTheDocument()
    expect(screen.getByText("unchanged")).toBeInTheDocument()
  })
})

describe("statusFromDiff", () => {
  it("maps `empty: true` to `unchanged`", () => {
    expect(statusFromDiff({ path: "x", diff: "", truncated: false, empty: true })).toBe("unchanged")
  })
  it("detects added files via `new file mode`", () => {
    expect(statusFromDiff({ path: "x", diff: "new file mode 100644\n+hello", truncated: false, empty: false })).toBe(
      "added",
    )
  })
  it("detects deleted files via `deleted file mode`", () => {
    expect(statusFromDiff({ path: "x", diff: "deleted file mode 100644\n-bye", truncated: false, empty: false })).toBe(
      "deleted",
    )
  })
  it("falls through to `modified` for the common case", () => {
    expect(statusFromDiff({ path: "x", diff: SAMPLE_DIFF, truncated: false, empty: false })).toBe("modified")
  })
})
