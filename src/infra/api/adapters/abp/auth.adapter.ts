/**
 * ABP auth adapter — implements `AuthPort`'s OAuth2 token grants by delegating
 * to `oauth2.service` (the `/connect/token` password + refresh flows) and
 * mapping the snake_case OAuth2 wire shape to the neutral `TokenSet`. This is
 * the only place the ABP OAuth2 grant detail is named at the port boundary.
 *
 * Mock mode is handled inside `oauth2.service` (`IS_MOCK` short-circuits to a
 * fake token bundle), so this adapter stays mock-agnostic and behavior is
 * byte-identical.
 */

import { login as oauth2Login, refreshToken as oauth2Refresh } from "@/infra/auth/oauth2.service"
import type { AuthPort, Credentials, TokenSet } from "@/shared/ports/backend"
import { sendPasswordResetCodeAbp, resetPasswordAbp } from "./account.adapter"

export const abpAuthPort: AuthPort = {
  async login(credentials: Credentials): Promise<TokenSet> {
    const t = await oauth2Login({ username: credentials.username, password: credentials.password })
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in }
  },

  async refresh(refreshToken: string): Promise<TokenSet> {
    const t = await oauth2Refresh({ refresh_token: refreshToken })
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in }
  },

  sendPasswordResetCode: sendPasswordResetCodeAbp,
  resetPassword: resetPasswordAbp,
}
