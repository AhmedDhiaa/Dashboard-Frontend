/**
 * Account service — self-service password recovery against the ABP
 * `/api/account/*` endpoints. Separate from `oauth2.service` (which owns the
 * token grant) because these run pre-auth, with no bearer token.
 *
 * Standalone mock mode short-circuits to a resolved promise: there's no real
 * email pipeline, so the UI flows through to its success state and the demo
 * stays self-contained. Flip `NEXT_PUBLIC_USE_MOCK_API=false` and these hit the
 * real ABP account module.
 */

import { apiClient } from "@/infra/api"
import { IS_MOCK } from "@/infra/api/mock"
import { APP_NAME } from "@/shared/config/brand"

export interface ResetPasswordInput {
  userId: string
  resetToken: string
  password: string
}

class AccountService {
  /**
   * Trigger ABP's password-reset email. ABP mails a link to
   * `${returnUrl}?userId=…&resetToken=…` — i.e. our /auth/reset-password page.
   * Always resolves on the client even for an unknown email (ABP does not
   * disclose whether an account exists — neither do we).
   */
  async sendPasswordResetCode(email: string): Promise<void> {
    if (IS_MOCK) return
    const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined
    await apiClient.post("/api/account/send-password-reset-code", {
      email,
      // ABP routes the email template + return URL by app name. If your ABP
      // OpenIddict application is registered under a different name, set it here.
      appName: APP_NAME,
      returnUrl,
    })
  }

  /** Complete the reset using the `userId` + `resetToken` from the email link. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    if (IS_MOCK) return
    await apiClient.post("/api/account/reset-password", input)
  }
}

export const accountService = new AccountService()
