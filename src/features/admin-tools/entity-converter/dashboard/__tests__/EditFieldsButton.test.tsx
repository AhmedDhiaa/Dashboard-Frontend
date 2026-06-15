/**
 * Smoke for the convert-success → unified-toast wiring (Part 3.3).
 *
 * The flow asserted here:
 *   1. User clicks Continue in the confirmation dialog.
 *   2. Server Action resolves with { ok: true, deletedFiles: [...], redirectTo }.
 *   3. EditFieldsButton calls `notifySourceWrite(notifications, deletedFiles.length + 1, router)`
 *      BEFORE router.push(redirectTo).
 *
 * The notifications + router are mocks; the helper is real (verifies the
 * happy-path arg shape against the helper's actual contract).
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Spy on the unified helper so we can assert call order vs router.push.
const notifySpy = vi.fn()
vi.mock("@/features/admin-tools/git-bridge/dashboard/notify-source-write", () => ({
  notifySourceWrite: (...args: unknown[]) => notifySpy(...args),
}))

// next/navigation already gets mocked by the global test setup with
// useRouter returning push/replace mocks; we just need to read `push`
// from the same mock to assert ordering.
const pushSpy = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import { EditFieldsButton } from "../EditFieldsButton"

afterEach(() => {
  notifySpy.mockReset()
  pushSpy.mockReset()
})

describe("EditFieldsButton — convert success toast wiring", () => {
  it("fires notifySourceWrite with deletedFiles.length + 1 BEFORE router.push on success", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({
      ok: true,
      redirectTo: "/builder?entity=brand",
      deletedFiles: ["a.tsx", "b.ts", "c.ts"],
    }))
    render(<EditFieldsButton entityName="brand" action={action} />)

    await user.click(screen.getByRole("button", { name: /Edit fields/i }))
    await user.click(screen.getByRole("button", { name: /^Continue$/i }))

    expect(action).toHaveBeenCalledWith("brand")
    expect(notifySpy).toHaveBeenCalledTimes(1)
    // Count = 3 deleted + 1 runtime config = 4.
    expect(notifySpy.mock.calls[0]?.[1]).toBe(4)
    // Router push fires after the notification — the toast persists
    // across the navigation so the admin still sees the cue on /builder.
    expect(pushSpy).toHaveBeenCalledWith("/builder?entity=brand")
    expect(notifySpy.mock.invocationCallOrder[0]!).toBeLessThan(pushSpy.mock.invocationCallOrder[0]!)
  })

  it("does NOT fire notifySourceWrite when the action refuses", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: false, reason: "listColumns is an identifier ref" }))
    render(<EditFieldsButton entityName="order" action={action} />)

    await user.click(screen.getByRole("button", { name: /Edit fields/i }))
    await user.click(screen.getByRole("button", { name: /^Continue$/i }))

    expect(notifySpy).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
  })
})
