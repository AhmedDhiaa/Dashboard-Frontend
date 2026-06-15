/**
 * notify-source-write — message-shape + variant + router-presence tests.
 *
 * The helper falls back to `notifications.success(messageString)` per
 * Part 3.3 spec because useNotification has no action-button surface
 * and react-hot-toast is lint-blocked outside the wrapper. These tests
 * pin the fallback behaviour: the message text always carries the
 * count + the Git-Bridge cue, and success is the chosen variant.
 */

import { describe, expect, it, vi } from "vitest"
import type { UseNotificationReturn } from "@/ui/application/hooks/useNotification"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { buildSourceWriteMessage, notifySourceWrite } from "../notify-source-write"

function makeNotifications(): UseNotificationReturn {
  return {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(() => "id"),
    dismiss: vi.fn(),
    undo: vi.fn(),
    promise: vi.fn(async p => p),
  }
}

describe("buildSourceWriteMessage", () => {
  it("uses singular `file` for count = 1", () => {
    expect(buildSourceWriteMessage(1, true)).toMatch(/^Wrote 1 file /)
    expect(buildSourceWriteMessage(1, false)).toMatch(/^Wrote 1 file /)
  })

  it("uses plural `files` for count > 1", () => {
    expect(buildSourceWriteMessage(5, true)).toMatch(/^Wrote 5 files /)
    expect(buildSourceWriteMessage(2, false)).toMatch(/^Wrote 2 files /)
  })

  it("clamps zero / negative counts to 1 (never 'Wrote 0 files')", () => {
    expect(buildSourceWriteMessage(0, true)).toMatch(/^Wrote 1 file/)
    expect(buildSourceWriteMessage(-3, true)).toMatch(/^Wrote 1 file/)
  })

  it("body always mentions Git Bridge so the admin knows where to review", () => {
    expect(buildSourceWriteMessage(3, true)).toMatch(/Git Bridge/i)
    expect(buildSourceWriteMessage(3, false)).toMatch(/Git Bridge/i)
  })
})

describe("notifySourceWrite", () => {
  it("fires exactly one success toast with the count + Git-Bridge cue", () => {
    const notifications = makeNotifications()
    const router = { push: vi.fn() } as unknown as ReturnType<typeof import("next/navigation").useRouter>
    notifySourceWrite(notifications, 3, router)
    expect(notifications.success).toHaveBeenCalledTimes(1)
    const [message, , options] = vi.mocked(notifications.success).mock.calls[0] ?? []
    expect(message).toMatch(/Wrote 3 files/)
    expect(message).toMatch(/Git Bridge/i)
    expect(options?.duration).toBe(6000)
  })

  it("fires the toast even when router is undefined (degraded gracefully)", () => {
    const notifications = makeNotifications()
    notifySourceWrite(notifications, 1, undefined)
    expect(notifications.success).toHaveBeenCalledTimes(1)
    const [message] = vi.mocked(notifications.success).mock.calls[0] ?? []
    expect(message).toMatch(/Wrote 1 file/)
  })

  it("never fires error / warning / info — success is the documented variant", () => {
    const notifications = makeNotifications()
    notifySourceWrite(notifications, 7, undefined)
    expect(notifications.error).not.toHaveBeenCalled()
    expect(notifications.warning).not.toHaveBeenCalled()
    expect(notifications.info).not.toHaveBeenCalled()
  })
})
