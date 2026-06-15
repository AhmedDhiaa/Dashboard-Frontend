import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSavePage } from "../useSavePage"
import type { PageSchema } from "../../../schema/page-schema"

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  isConnected: true,
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  captureException: vi.fn(),
  loggerDebug: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock("@/infra/socket/components/SocketProvider", () => ({
  useSocketContext: () => ({
    isConnected: mocks.isConnected,
    getSocket: () => ({ invoke: mocks.invoke, on: vi.fn() }),
  }),
}))

vi.mock("@/infra/observability/error-reporter", () => ({
  errorReporter: { captureException: mocks.captureException, captureMessage: vi.fn() },
}))

vi.mock("@/shared/logger", () => ({
  logger: {
    debug: mocks.loggerDebug,
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))

const baseSchema: PageSchema = {
  id: "draft-page",
  version: "1.0",
  title: { en: "T", ar: "ع" },
  permission: "Api.Admin.PageBuilder",
  layout: "full",
  blocks: [],
} as never

const notify = {
  success: mocks.notifySuccess,
  error: mocks.notifyError,
  warning: mocks.notifyWarning,
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  promise: vi.fn(),
} as unknown as Parameters<ReturnType<typeof useSavePage>["trigger"]>[0]["notify"]

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.notifySuccess.mockReset()
  mocks.notifyError.mockReset()
  mocks.notifyWarning.mockReset()
  mocks.captureException.mockReset()
  mocks.loggerDebug.mockReset()
  mocks.loggerWarn.mockReset()
  mocks.loggerError.mockReset()
  mocks.isConnected = true
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })) as unknown as typeof fetch
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useSavePage — feature flag off (default)", () => {
  it("does NOT attempt the SignalR invoke when the flag is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD", "")
    const onSaved = vi.fn()
    const { result } = renderHook(() => useSavePage())
    await act(async () => {
      await result.current.trigger({ schema: baseSchema, notify, onSaved })
    })
    expect(onSaved).toHaveBeenCalledOnce()
    expect(mocks.notifySuccess).toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(mocks.loggerDebug).not.toHaveBeenCalled()
  })
})

describe("useSavePage — feature flag on, missing hub method", () => {
  it("logs at debug + does not pollute Sentry when the invoke throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD", "true")
    mocks.invoke.mockRejectedValueOnce(new Error("HubException: Method does not exist."))
    const onSaved = vi.fn()
    const { result } = renderHook(() => useSavePage())
    await act(async () => {
      await result.current.trigger({ schema: baseSchema, notify, onSaved })
    })
    // Save itself succeeded.
    expect(onSaved).toHaveBeenCalledOnce()
    expect(mocks.notifySuccess).toHaveBeenCalled()
    expect(mocks.notifyError).not.toHaveBeenCalled()
    // SignalR error is silenced to debug only — no Sentry, no error log.
    expect(mocks.invoke).toHaveBeenCalledWith("PageUpdated", "draft-page")
    expect(mocks.loggerDebug).toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  it("succeeds quietly when the invoke resolves normally", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD", "true")
    mocks.invoke.mockResolvedValueOnce(undefined)
    const onSaved = vi.fn()
    const { result } = renderHook(() => useSavePage())
    await act(async () => {
      await result.current.trigger({ schema: baseSchema, notify, onSaved })
    })
    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(mocks.loggerDebug).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  it("does not attempt the invoke when the socket is disconnected", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD", "true")
    mocks.isConnected = false
    const onSaved = vi.fn()
    const { result } = renderHook(() => useSavePage())
    await act(async () => {
      await result.current.trigger({ schema: baseSchema, notify, onSaved })
    })
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledOnce()
  })
})

describe("useSavePage — fetch-level errors still surface normally", () => {
  it("reports a 500 from the page CRUD endpoint via Sentry + notify.error", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD", "")
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "DB exploded" }),
    })) as unknown as typeof fetch
    const onSaved = vi.fn()
    const { result } = renderHook(() => useSavePage())
    await act(async () => {
      await result.current.trigger({ schema: baseSchema, notify, onSaved })
    })
    expect(onSaved).not.toHaveBeenCalled()
    expect(mocks.notifyError).toHaveBeenCalled()
    expect(mocks.captureException).toHaveBeenCalled()
  })
})
