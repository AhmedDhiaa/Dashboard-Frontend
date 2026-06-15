import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { applyInterpolation, useActionExecutor } from "../ActionExecutor"

// vi.mock factories are hoisted to the top of the file. Anything they
// reference must come from `vi.hoisted(...)` rather than module-level const.
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  apiRequest: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
  captureException: vi.fn(),
  openDialog: vi.fn<(opts: unknown) => string>(() => "dialog-1"),
  openDrawer: vi.fn<(opts: unknown) => string>(() => "drawer-1"),
  closeOverlay: vi.fn(),
  closeAll: vi.fn(),
  // Stable sentinel so we can assert content was passed through unchanged.
  renderBlocksMarker: { __renderBlocks: true },
  renderBlocks: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock("../page-builder-action.service", () => ({
  runPageBuilderApiRequest: (req: unknown) => mocks.apiRequest(req),
}))

vi.mock("../render-blocks", () => ({
  renderBlocks: (blocks: unknown) => mocks.renderBlocks(blocks),
}))

vi.mock("@/ui/application/hooks/useNotification", () => ({
  useNotification: () => ({
    success: mocks.notifySuccess,
    error: mocks.notifyError,
    warning: mocks.notifyWarning,
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }),
}))

vi.mock("@/ui/application/hooks/useOverlayHost", () => ({
  useOverlayHost: () => ({
    openDialog: mocks.openDialog,
    openDrawer: mocks.openDrawer,
    closeOverlay: mocks.closeOverlay,
    closeAll: mocks.closeAll,
  }),
}))

vi.mock("@/infra/observability/error-reporter", () => ({
  errorReporter: {
    captureException: mocks.captureException,
    captureMessage: vi.fn(),
  },
}))

beforeEach(() => {
  mocks.push.mockReset()
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
  mocks.apiRequest.mockReset()
  mocks.notifyError.mockReset()
  mocks.notifySuccess.mockReset()
  mocks.notifyWarning.mockReset()
  mocks.captureException.mockReset()
  mocks.openDialog.mockReset()
  mocks.openDialog.mockReturnValue("dialog-1")
  mocks.openDrawer.mockReset()
  mocks.openDrawer.mockReturnValue("drawer-1")
  mocks.closeOverlay.mockReset()
  mocks.closeAll.mockReset()
  mocks.renderBlocks.mockReset()
  mocks.renderBlocks.mockReturnValue(mocks.renderBlocksMarker)
})

// ─── Interpolation ─────────────────────────────────────────────────────────

describe("applyInterpolation", () => {
  it("substitutes {id} from row", () => {
    expect(applyInterpolation("/orders/{id}/close", { row: { id: 42 } })).toBe("/orders/42/close")
  })

  it("substitutes {entityId} from top-level entityId", () => {
    expect(applyInterpolation("/users/{entityId}", { entityId: "abc" })).toBe("/users/abc")
  })

  it("prefers params > row > entityId for the same token", () => {
    expect(
      applyInterpolation("/x/{id}", {
        params: { id: "from-params" },
        row: { id: "from-row" },
        entityId: "from-entity",
      }),
    ).toBe("/x/from-params")
    expect(applyInterpolation("/x/{id}", { row: { id: "from-row" }, entityId: "from-entity" })).toBe("/x/from-row")
  })

  it("reports unknown tokens via errorReporter and leaves them unresolved", () => {
    const out = applyInterpolation("/x/{missing}", {})
    expect(out).toBe("/x/{missing}")
    expect(mocks.captureException).toHaveBeenCalledOnce()
  })
})

// ─── api action ───────────────────────────────────────────────────────────

describe("useActionExecutor — api action", () => {
  it("calls apiClient.request with the interpolated URL + method + body", async () => {
    mocks.apiRequest.mockResolvedValueOnce({ data: { ok: true } })
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current(
        { type: "api", method: "DELETE", endpoint: "/orders/{id}", onSuccess: { refresh: false } },
        { row: { id: 7 } },
      )
    })
    expect(mocks.apiRequest).toHaveBeenCalledWith({ url: "/orders/7", method: "DELETE", data: undefined })
  })

  it("notifies on success when onSuccess.notify is set", async () => {
    mocks.apiRequest.mockResolvedValueOnce({ data: {} })
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current(
        {
          type: "api",
          method: "POST",
          endpoint: "/x",
          onSuccess: { refresh: false, notify: { en: "common.success", ar: "نجح" } },
        },
        {},
      )
    })
    expect(mocks.notifySuccess).toHaveBeenCalled()
  })

  it("reports the error via errorReporter and notifies on failure", async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error("boom"))
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current({ type: "api", method: "GET", endpoint: "/x" }, {})
    })
    expect(mocks.captureException).toHaveBeenCalled()
    expect(mocks.notifyError).toHaveBeenCalled()
  })

  it("skips execution when confirm prompts and the user cancels", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current(
        {
          type: "api",
          method: "DELETE",
          endpoint: "/x",
          confirm: {
            title: { en: "Sure?", ar: "متأكد؟" },
            message: { en: "Cannot undo.", ar: "لا تراجع." },
            destructive: true,
          },
        },
        {},
      )
    })
    expect(mocks.apiRequest).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})

// ─── navigate action ─────────────────────────────────────────────────────

describe("useActionExecutor — navigate action", () => {
  it("calls router.push with the interpolated href", async () => {
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current({ type: "navigate", href: "/orders/{id}/edit", external: false }, { row: { id: 99 } })
    })
    expect(mocks.push).toHaveBeenCalledWith("/orders/99/edit")
  })

  it("opens external links in a new tab", async () => {
    const winOpen = vi.spyOn(window, "open").mockImplementation(() => null)
    const { result } = renderHook(() => useActionExecutor())
    await act(async () => {
      await result.current({ type: "navigate", href: "https://example.com", external: true }, {})
    })
    expect(winOpen).toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    winOpen.mockRestore()
  })
})

// ─── dialog / drawer ─────────────────────────────────────────────────────

describe("useActionExecutor — dialog action", () => {
  it("opens a dialog with the EN title and the renderer's output", async () => {
    const { result } = renderHook(() => useActionExecutor())
    const blocks = [{ id: "b1", type: "text" } as never]
    await act(async () => {
      await result.current({ type: "dialog", title: { en: "Edit Order", ar: "تعديل الطلب" }, blocks }, {})
    })
    expect(mocks.renderBlocks).toHaveBeenCalledWith(blocks)
    expect(mocks.openDialog).toHaveBeenCalledWith({
      title: "Edit Order",
      content: mocks.renderBlocksMarker,
    })
    expect(mocks.notifyWarning).not.toHaveBeenCalled()
  })
})

describe("useActionExecutor — drawer action", () => {
  it("opens a drawer with the schema side passed straight through", async () => {
    const { result } = renderHook(() => useActionExecutor())
    const blocks = [{ id: "b1", type: "text" } as never]
    await act(async () => {
      await result.current({ type: "drawer", title: { en: "Filters", ar: "الفلاتر" }, side: "end", blocks }, {})
    })
    expect(mocks.renderBlocks).toHaveBeenCalledWith(blocks)
    expect(mocks.openDrawer).toHaveBeenCalledWith({
      title: "Filters",
      side: "end",
      content: mocks.renderBlocksMarker,
    })
  })

  it("forwards every schema side without translation (RTL flip lives in the host)", async () => {
    const { result } = renderHook(() => useActionExecutor())
    for (const side of ["start", "end", "top", "bottom"] as const) {
      mocks.openDrawer.mockClear()
      await act(async () => {
        await result.current({ type: "drawer", title: { en: "T", ar: "ت" }, side, blocks: [] }, {})
      })
      expect(mocks.openDrawer).toHaveBeenCalledWith(expect.objectContaining({ side }))
    }
  })
})

// The defensive `resolveOverlayDeps` branch in ActionExecutor.ts (which
// reports an error and notifies on a missing overlay host) is unreachable
// through `useActionExecutor` itself: the hook auto-injects the host
// from `useOverlayHost`, and `??` semantics replace any explicit
// `undefined` the caller passes. The branch exists as belt-and-suspenders
// for any future direct caller of the executor that hand-builds a
// context, and isn't exercised here.
