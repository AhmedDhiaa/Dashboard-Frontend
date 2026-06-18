/**
 * ABP account adapter — self-service password recovery against the ABP
 * `/api/account/*` endpoints. These run pre-auth (no bearer token); the calling
 * service owns mock short-circuiting and building the return URL / app name.
 * This is the only place those ABP account URLs are named.
 *
 * Goes through `apiClient`, so mock mode (axios-adapter swap) keeps working.
 */

import { apiClient } from "@/infra/api"
import type { PasswordResetRequest, PasswordReset } from "@/shared/ports/backend"

/** Trigger ABP's password-reset email. */
export async function sendPasswordResetCodeAbp(request: PasswordResetRequest): Promise<void> {
  await apiClient.post("/api/account/send-password-reset-code", {
    email: request.email,
    appName: request.appName,
    returnUrl: request.returnUrl,
  })
}

/** Complete the reset using the `userId` + `resetToken` from the email link. */
export async function resetPasswordAbp(reset: PasswordReset): Promise<void> {
  await apiClient.post("/api/account/reset-password", reset)
}
