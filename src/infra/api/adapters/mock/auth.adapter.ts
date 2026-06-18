/**
 * Mock auth port — standalone-mode `AuthPort`.
 *
 * Returns the seeded demo token bundle directly (no network), so when the
 * composition root selects the mock backend, login/refresh resolve to the
 * "Demo Admin" session and password recovery is a no-op (there's no email
 * pipeline offline). Reuses the same seed as the lower-level oauth2 mock, so the
 * token strings are identical whichever path runs.
 *
 * Imports only the LIGHT auth seed (`handlers/auth`), never the entity store, so
 * it is safe in the server graph the composition root is part of.
 */

import type { AuthPort, TokenSet } from "@/shared/ports/backend"
import { mockTokenResponse } from "@/infra/api/mock/handlers/auth"

function seededTokenSet(): TokenSet {
  const t = mockTokenResponse()
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in }
}

export const mockAuthPort: AuthPort = {
  async login(): Promise<TokenSet> {
    return seededTokenSet()
  },
  async refresh(): Promise<TokenSet> {
    return seededTokenSet()
  },
  async sendPasswordResetCode(): Promise<void> {
    // No email pipeline offline — flow through to the success state.
  },
  async resetPassword(): Promise<void> {
    // No-op offline.
  },
}
