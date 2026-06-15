/**
 * Smoke for the restore-success → toast + router.refresh wiring.
 * Mirrors EditFieldsButton.test.tsx — mock the Server-Action prop +
 * the notifySourceWrite helper, drive the confirm dialog, assert
 * the right side-effects fire in the right order.
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const notifySpy = vi.fn()
vi.mock("@/features/admin-tools/git-bridge/dashboard/notify-source-write", () => ({
  notifySourceWrite: (...args: unknown[]) => notifySpy(...args),
}))

const errorSpy = vi.fn()
vi.mock("@/ui/application", () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: errorSpy,
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }),
}))

const pushSpy = vi.fn()
const refreshSpy = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: refreshSpy,
  }),
}))

import { RestoreConvertButton } from "../RestoreConvertButton"

const VALID_BACKUP_ID = "2026-05-13T12-34-56-789Z"

afterEach(() => {
  notifySpy.mockReset()
  errorSpy.mockReset()
  pushSpy.mockReset()
  refreshSpy.mockReset()
})

describe("RestoreConvertButton", () => {
  it("opens a confirmation dialog with the backupId before calling the action", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({
      ok: true,
      restoredFiles: ["a.tsx", "b.ts", "c.ts"],
      removedRuntimeId: "brand",
      migratedI18nKeyCount: 6,
      safetyBackupId: "2026-05-13T22-22-22-222Z",
    }))
    render(<RestoreConvertButton entityName="brand" backupId={VALID_BACKUP_ID} action={action} />)

    await user.click(screen.getByRole("button", { name: /Restore from source/i }))
    // Dialog renders with the backup id visible to the admin.
    expect(screen.getByText(VALID_BACKUP_ID)).toBeInTheDocument()
    // Action NOT called yet — only fires on Continue.
    expect(action).not.toHaveBeenCalled()
  })

  it("on success: fires notifySourceWrite (restoredFiles+1) + router.refresh, NO router.push", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({
      ok: true,
      restoredFiles: ["a.tsx", "b.ts", "c.ts"],
      removedRuntimeId: "brand",
      migratedI18nKeyCount: 6,
      safetyBackupId: "2026-05-13T22-22-22-222Z",
    }))
    render(<RestoreConvertButton entityName="brand" backupId={VALID_BACKUP_ID} action={action} />)

    await user.click(screen.getByRole("button", { name: /Restore from source/i }))
    await user.click(screen.getByRole("button", { name: /^Continue$/i }))

    expect(action).toHaveBeenCalledWith("brand", VALID_BACKUP_ID)
    expect(notifySpy).toHaveBeenCalledTimes(1)
    // Count = 3 restored files + 1 runtime config removal.
    expect(notifySpy.mock.calls[0]?.[1]).toBe(4)
    // router.refresh (re-fetch RSC tree), NOT push — the admin stays on /admin/entities.
    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it("on refusal: fires notifications.error, no toast and no router.refresh", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: false, reason: "Backup not found" }))
    render(<RestoreConvertButton entityName="brand" backupId={VALID_BACKUP_ID} action={action} />)

    await user.click(screen.getByRole("button", { name: /Restore from source/i }))
    await user.click(screen.getByRole("button", { name: /^Continue$/i }))

    expect(errorSpy).toHaveBeenCalledWith("Backup not found")
    expect(notifySpy).not.toHaveBeenCalled()
    expect(refreshSpy).not.toHaveBeenCalled()
  })
})
