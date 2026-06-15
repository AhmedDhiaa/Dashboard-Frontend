import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { useOverlayHost } from "../useOverlayHost"
import { OverlayHostProvider } from "../../contexts/OverlayHostContext"

// Same locale + theme stubs the OverlayHost suite uses; the host renders
// nothing in these tests but the provider still pulls the locale at mount.
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}))

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("useOverlayHost", () => {
  it("throws a clear error when called outside an OverlayHostProvider", () => {
    expect(() => renderHook(() => useOverlayHost())).toThrowError(/must be used inside an <OverlayHostProvider>/)
  })

  it("returns the four-method API when called inside a provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <OverlayHostProvider>{children}</OverlayHostProvider>
    const { result } = renderHook(() => useOverlayHost(), { wrapper })
    expect(typeof result.current.openDialog).toBe("function")
    expect(typeof result.current.openDrawer).toBe("function")
    expect(typeof result.current.closeOverlay).toBe("function")
    expect(typeof result.current.closeAll).toBe("function")
  })
})
