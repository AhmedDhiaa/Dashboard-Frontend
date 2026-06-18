import { afterEach, beforeAll, afterAll, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom"
import { server as mswServer } from "./msw/server"
import { mswFixtures } from "./msw/fixtures"
// Register the `toHaveNoViolations` matcher globally so primitive a11y
// tests can call `expect(container).toHaveNoViolations()` without per-file
// boilerplate. The published `vitest-axe/extend-expect` entry is empty
// in v0.1.0, so we wire the matcher in directly with `expect.extend`.
import { expect } from "vitest"
import * as axeMatchers from "vitest-axe/matchers"
expect.extend(axeMatchers)

// jsdom doesn't implement ResizeObserver — Radix uses it for primitives like
// Slider and Dropdown placement. A no-op stub keeps the components happy in
// unit tests where layout isn't measured.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// jsdom doesn't implement matchMedia — provide a stub for components that
// query for prefers-color-scheme / prefers-reduced-motion (theme manager,
// useMediaQuery, etc.).
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// jsdom doesn't implement HTMLCanvasElement.getContext — recharts and other
// chart primitives probe it, which prints a noisy "Not implemented" line to the
// virtual console. A null-returning stub matches jsdom's actual (null) return
// while silencing the warning; chart tests assert on the DOM, not the canvas.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement["getContext"]
}

// MSW lifecycle: start once, reset handlers + fixtures per test, close after.
beforeAll(() => mswServer.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => {
  cleanup()
  mswServer.resetHandlers()
  mswFixtures.reset()
})
afterAll(() => mswServer.close())

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))

// Mock the permission context so component tests can render without wrapping
// every render in PermissionProvider. Returns admin permissions by default;
// tests that need narrower behavior can override with `vi.mocked(...)`.
vi.mock("@/core/auth/context/PermissionContext", () => {
  const adminCtx = {
    grantedPermissions: new Set<string>(),
    isGranted: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    getEntityPermissions: () => ({ canView: true, canCreate: true, canUpdate: true, canDelete: true }),
    getFieldPermissions: () => [],
    isAdmin: true,
    isLoading: false,
    settings: {},
    features: {},
    refreshPermissions: vi.fn(),
  }
  return {
    PermissionProvider: ({ children }: { children: React.ReactNode }) => children,
    PermissionContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
    usePermissionContext: () => adminCtx,
    useEntityPermissions: () => ({ canView: true, canCreate: true, canUpdate: true, canDelete: true, canEdit: true }),
    useColumnPermissions: <T>(cols: T[]) => cols,
    useFieldPermissions: () => [],
    useIsAdmin: () => true,
  }
})

// Mock @/shared/config — keep it broad enough that production imports of
// `config`, locale helpers, and `useT` all resolve in unit tests.
vi.mock("@/shared/config", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useT: () => (key: string, params?: any) => {
    if (params) {
      return key.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`)
    }
    return key
  },
  config: {
    api: {
      baseUrl: "http://localhost:3000",
      timeout: 10000,
      oauth2: {
        tokenUrl: "/connect/token",
        clientId: "test-client",
        scope: "test-scope",
      },
    },
  },
  getLocaleFromCookie: () => "en",
  DEFAULT_LOCALE: "en",
  isValidLocale: (locale: string) => locale === "en" || locale === "ar",
  toValidLocale: (locale?: string | null) => (locale === "ar" ? "ar" : "en"),
  getCurrentLocale: () => "en",
  setLocaleCookie: vi.fn(),
  persistLocale: vi.fn(),
  useLocale: () => ({
    locale: "en" as const,
    direction: "ltr" as const,
    isRTL: false,
    displayName: "English",
    flag: "🇬🇧",
    start: "left",
    end: "right",
    dir: <T>(ltr: T, _rtl: T): T => ltr,
  }),
}))
