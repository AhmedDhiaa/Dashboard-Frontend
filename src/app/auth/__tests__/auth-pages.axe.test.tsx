/**
 * Axe accessibility gate for the password-recovery pages. These are public,
 * pre-auth surfaces (anyone can hit them), so a11y regressions here are
 * especially visible. Mirrors the showcase axe suite: color-contrast is off
 * (jsdom can't run the Tailwind pipeline), everything else is enforced.
 */

import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"

import { ThemeProvider } from "@/ui/theme/ThemeManager"
import { renderAndSettle } from "@/shared/test-utils/axe-render"

// Give the reset page a token so it renders the FORM (password inputs) — the
// a11y-relevant state — rather than the invalid-link fallback.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("userId=abc-123&resetToken=tok-xyz"),
}))

import ForgotPasswordPage from "@/app/auth/forgot-password/page"
import ResetPasswordPage from "@/app/auth/reset-password/page"

const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
  },
}

describe("auth recovery pages — axe", () => {
  it("forgot-password page has zero a11y violations", async () => {
    const { container } = await renderAndSettle(
      <ThemeProvider>
        <ForgotPasswordPage />
      </ThemeProvider>,
    )
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations()
  })

  it("reset-password page (with a valid token) has zero a11y violations", async () => {
    const { container } = await renderAndSettle(
      <ThemeProvider>
        <ResetPasswordPage />
      </ThemeProvider>,
    )
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations()
  })
})
