/**
 * REST `AuthPort` — token login/refresh + self-service recovery against a plain
 * JSON backend (`POST /auth/login` → `{ token, refreshToken, expiresIn }`),
 * mapping that shape to the neutral `TokenSet`. Contrast with ABP's OAuth2
 * `/connect/token` grant — same port, different wire.
 */

import { restFetch } from "./transport"
import type { AuthPort, Credentials, TokenSet, PasswordReset, PasswordResetRequest } from "@/shared/ports/backend"

interface RestTokens {
  token: string
  refreshToken?: string
  expiresIn?: number
}

function toTokenSet(t: RestTokens): TokenSet {
  return { accessToken: t.token, refreshToken: t.refreshToken, expiresIn: t.expiresIn }
}

export const restAuthPort: AuthPort = {
  async login(credentials: Credentials): Promise<TokenSet> {
    const { data } = await restFetch<RestTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    })
    return toTokenSet(data)
  },

  async refresh(refreshToken: string): Promise<TokenSet> {
    const { data } = await restFetch<RestTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    })
    return toTokenSet(data)
  },

  async sendPasswordResetCode(request: PasswordResetRequest): Promise<void> {
    await restFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: request.email }) })
  },

  async resetPassword(reset: PasswordReset): Promise<void> {
    await restFetch("/auth/reset-password", { method: "POST", body: JSON.stringify(reset) })
  },
}
