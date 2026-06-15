import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"
import { OverlayHostProvider, resolveSheetSide } from "../OverlayHostContext"
import { useOverlayHost } from "../../hooks/useOverlayHost"

// `useLocale` from next-intl is the one piece OverlayHost reads to flip
// `start`/`end` to physical sides. The mock returns whatever the active
// test set into `localeRef` so the same module mock can drive both
// LTR and RTL tests.
const localeRef = { current: "en" }
vi.mock("next-intl", () => ({
  useLocale: () => localeRef.current,
}))

// The Dialog primitive consumes ThemeManager. The full theme is irrelevant
// to host behaviour — pass an empty settings object.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

beforeEach(() => {
  cleanup()
  localeRef.current = "en"
})

// Helper that exposes the host API on a button so tests can drive it
// imperatively without RTL handles.
function HostHarness({ onMount }: { onMount: (api: ReturnType<typeof useOverlayHost>) => void }) {
  const api = useOverlayHost()
  onMount(api)
  return null
}

function withProvider(node: React.ReactNode) {
  return render(<OverlayHostProvider>{node}</OverlayHostProvider>)
}

// ─── resolveSheetSide ─────────────────────────────────────────────────────

describe("resolveSheetSide", () => {
  it("maps `start` to `left` in LTR, `right` in RTL", () => {
    expect(resolveSheetSide("start", false)).toBe("left")
    expect(resolveSheetSide("start", true)).toBe("right")
  })

  it("maps `end` to `right` in LTR, `left` in RTL", () => {
    expect(resolveSheetSide("end", false)).toBe("right")
    expect(resolveSheetSide("end", true)).toBe("left")
  })

  it("passes `top` / `bottom` through unchanged", () => {
    expect(resolveSheetSide("top", true)).toBe("top")
    expect(resolveSheetSide("top", false)).toBe("top")
    expect(resolveSheetSide("bottom", true)).toBe("bottom")
    expect(resolveSheetSide("bottom", false)).toBe("bottom")
  })
})

// ─── openDialog ───────────────────────────────────────────────────────────

describe("OverlayHostProvider — openDialog", () => {
  it("renders a dialog with the supplied title and content", () => {
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDialog({ title: "Confirm delete", content: <div data-testid="dialog-body">Are you sure?</div> })
    })
    expect(screen.getByText("Confirm delete")).toBeInTheDocument()
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument()
  })

  it("returns a unique id per call and stacks multiple dialogs", () => {
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    let id1 = ""
    let id2 = ""
    act(() => {
      id1 = api!.openDialog({ title: "First", content: <div>one</div> })
      id2 = api!.openDialog({ title: "Second", content: <div>two</div> })
    })
    expect(id1).not.toEqual(id2)
    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
  })

  it("calls opts.onClose when the dialog is closed via closeOverlay", () => {
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    const onClose = vi.fn()
    let id = ""
    act(() => {
      id = api!.openDialog({ title: "x", content: <div>x</div>, onClose })
    })
    act(() => {
      api!.closeOverlay(id)
    })
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByText("x")).toBeNull()
  })
})

// ─── openDrawer ───────────────────────────────────────────────────────────

describe("OverlayHostProvider — openDrawer", () => {
  it("renders a sheet with the schema side stamped onto data attributes", () => {
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDrawer({ title: "Filters", side: "end", content: <div>body</div> })
    })
    const drawer = document.querySelector('[data-overlay-logical-side="end"]')
    expect(drawer).not.toBeNull()
  })

  it("flips `end` to physical `right` in LTR locales", () => {
    localeRef.current = "en"
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDrawer({ title: "Filters", side: "end", content: <div>body</div> })
    })
    const drawer = document.querySelector('[data-overlay-logical-side="end"]')
    expect(drawer?.getAttribute("data-overlay-side")).toBe("right")
  })

  it("flips `end` to physical `left` in `ar` locales", () => {
    localeRef.current = "ar"
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDrawer({ title: "Filters", side: "end", content: <div>body</div> })
    })
    const drawer = document.querySelector('[data-overlay-logical-side="end"]')
    expect(drawer?.getAttribute("data-overlay-side")).toBe("left")
  })

  it("flips `start` to physical `left` in LTR and `right` in RTL", () => {
    localeRef.current = "en"
    let api: ReturnType<typeof useOverlayHost> | null = null
    const r = withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDrawer({ title: "Nav", side: "start", content: <div>body</div> })
    })
    expect(document.querySelector('[data-overlay-logical-side="start"]')?.getAttribute("data-overlay-side")).toBe(
      "left",
    )
    r.unmount()

    localeRef.current = "ar"
    let api2: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api2 = a)} />)
    act(() => {
      api2!.openDrawer({ title: "Nav", side: "start", content: <div>body</div> })
    })
    expect(document.querySelector('[data-overlay-logical-side="start"]')?.getAttribute("data-overlay-side")).toBe(
      "right",
    )
  })

  it("passes `top` and `bottom` through unchanged regardless of locale", () => {
    localeRef.current = "ar"
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    act(() => {
      api!.openDrawer({ title: "Bar", side: "top", content: <div>body</div> })
    })
    expect(document.querySelector('[data-overlay-logical-side="top"]')?.getAttribute("data-overlay-side")).toBe("top")
  })
})

// ─── closeAll ─────────────────────────────────────────────────────────────

describe("OverlayHostProvider — closeAll", () => {
  it("removes every open overlay and runs each registered onClose", () => {
    let api: ReturnType<typeof useOverlayHost> | null = null
    withProvider(<HostHarness onMount={a => (api = a)} />)
    const onCloseA = vi.fn()
    const onCloseB = vi.fn()
    act(() => {
      api!.openDialog({ title: "A", content: <div>a</div>, onClose: onCloseA })
      api!.openDrawer({ title: "B", content: <div>b</div>, onClose: onCloseB })
    })
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("B")).toBeInTheDocument()
    act(() => {
      api!.closeAll()
    })
    expect(screen.queryByText("A")).toBeNull()
    expect(screen.queryByText("B")).toBeNull()
    expect(onCloseA).toHaveBeenCalledOnce()
    expect(onCloseB).toHaveBeenCalledOnce()
  })
})
