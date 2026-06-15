import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { login, refreshToken } from "@/infra/auth/oauth2.service"
import { config } from "@/shared/config"
import { logger } from "@/shared/logger"
import type { ExtendedJWT, ExtendedSession, ExtendedUser } from "@/shared/types"
import {
  TOKEN_REFRESH_BUFFER_SECONDS,
  DEFAULT_TOKEN_LIFETIME_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  JWT_UPDATE_AGE_SECONDS,
} from "@/infra/auth/auth-constants"
import { IS_MOCK } from "@/infra/api/mock"
import { mockUserProfile } from "@/infra/api/mock/handlers/auth"

// ─── In-flight refresh deduplication ─────────────────────────────────────────
// Prevents thundering-herd: if multiple tabs trigger a refresh simultaneously,
// only ONE network call is made and all callers share the same promise.

const _refreshInFlight = new Map<string, Promise<ExtendedJWT>>()

/** Normalize and extract user profile from ABP configuration data */
function normalizeUserProfile(data: unknown): ExtendedUser | null {
  const typedData = data as {
    currentUser?: ExtendedUser
    auth?: { grantedPolicies?: Record<string, boolean>; policies?: Record<string, boolean> }
  }
  const currentUser = typedData.currentUser
  if (!currentUser) return null

  // Extract grantedPolicies from ABP auth section → user.grantedPermissions
  const grantedPolicies: Record<string, boolean> = typedData.auth?.grantedPolicies ?? typedData.auth?.policies ?? {}
  currentUser.grantedPermissions = Object.keys(grantedPolicies).filter(key => grantedPolicies[key])

  // Normalize roles to lowercase for consistent admin checks
  currentUser.roles = currentUser.roles?.map((r: string) => r.toLowerCase()) ?? []

  return currentUser
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch user profile from ABP application-configuration endpoint with a 10 s timeout + 1 retry */
async function fetchUserProfile(accessToken: string): Promise<ExtendedUser | null> {
  // Standalone mock mode: return the demo "Demo Admin" profile (all
  // permissions) without any network call.
  if (IS_MOCK) {
    return mockUserProfile() as unknown as ExtendedUser
  }

  const serverApiUrl = process.env.API_URL
  const publicApiUrl = config.api.baseUrl || process.env.NEXT_PUBLIC_API_URL || ""
  const baseUrl = (serverApiUrl || publicApiUrl).replace(/\/$/, "")
  const url = `${baseUrl}/api/abp/application-configuration?IncludeLocalizationResources=false`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    try {
      const response = await fetch(url, { headers, signal: controller.signal })

      if (!response.ok) {
        logger.error(`Failed to fetch application profile: ${response.status} ${response.statusText}`)
        if (response.status === 401 || response.status === 403) return null
        if (response.status >= 500 && attempt === 0) continue
        return null
      }

      return normalizeUserProfile(await response.json())
    } catch (error) {
      const isAbort = (error as Error).name === "AbortError"
      logger.error(isAbort ? `Profile fetch timeout (attempt ${attempt + 1})` : "Error fetching user profile:", error)
      if (attempt < 1) continue
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}

/**
 * Strip large fields (grantedPermissions, permissions) from the user object
 * before it is serialized into the JWT cookie. This prevents HTTP 431 errors
 * (Request Header Fields Too Large). Permissions are loaded client-side
 * by useAppConfig / PermissionContext instead.
 */
function slimUserForJWT(user: ExtendedUser): ExtendedUser {
  return {
    id: user.id,
    name: user.name,
    surName: user.surName,
    email: user.email,
    userName: user.userName,
    isAuthenticated: user.isAuthenticated,
    roles: user.roles,
    roleNames: user.roleNames,
    tenantId: user.tenantId,
    // Explicitly omit: grantedPermissions, permissions
  }
}

// Helper to create user session from token response
async function createUserSession(
  tokenResponse: { access_token: string; refresh_token: string; expires_in?: number },
  username: string,
) {
  const expires_at = Date.now() + (tokenResponse.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000
  const userProfile = await fetchUserProfile(tokenResponse.access_token)

  // Join name and surName if available
  const fullName = userProfile ? [userProfile.name, userProfile.surName].filter(Boolean).join(" ") : null

  return {
    id: userProfile?.id || username,
    name: fullName || userProfile?.userName || username,
    email: userProfile?.email || username,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expires_at,
    expires_in: tokenResponse.expires_in,
    user: userProfile
      ? {
          ...userProfile,
          name: fullName || userProfile.name,
        }
      : null,
  }
}

/**
 * Perform a token refresh with in-flight deduplication.
 * Multiple callers with the same refresh token share one network request.
 */
async function performRefresh(extendedToken: ExtendedJWT): Promise<ExtendedJWT> {
  const refreshKey = extendedToken.refreshToken!

  // Return the in-flight promise if one already exists for this refresh token
  const existing = _refreshInFlight.get(refreshKey)
  if (existing) {
    logger.debug("JWT: Joining existing in-flight refresh")
    return existing
  }

  const refreshPromise = (async (): Promise<ExtendedJWT> => {
    try {
      logger.info("JWT: Refreshing expiring token...")
      const refreshed = await refreshToken({ refresh_token: refreshKey })

      return {
        ...extendedToken,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? extendedToken.refreshToken,
        expires_at: Date.now() + (refreshed.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS) * 1000,
        error: undefined,
      }
    } catch (error) {
      logger.error("JWT: Refresh failed:", error)
      return {
        ...extendedToken,
        accessToken: undefined,
        refreshToken: undefined,
        expires_at: undefined,
        error: "RefreshAccessTokenError",
      }
    }
  })()

  _refreshInFlight.set(refreshKey, refreshPromise)

  try {
    return await refreshPromise
  } finally {
    // Always clean up the in-flight entry, success or failure
    _refreshInFlight.delete(refreshKey)
  }
}

// ─── NextAuth Config ──────────────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        try {
          logger.info(`[AUTH-FLOW] 3. Server-side authorize() hook started for user: ${credentials.username}`)
          logger.info(
            `[AUTH-FLOW] 3.1. Calling ABP OAuth2 login endpoint at: ${config.api.baseUrl || process.env.NEXT_PUBLIC_API_URL}`,
          )
          const tokenResponse = await login({
            username: credentials.username as string,
            password: credentials.password as string,
          })

          if (!tokenResponse.access_token) {
            logger.warn("[AUTH-FLOW] 3.2. ABP Login failed: No access token in response.")
            return null
          }

          logger.info("[AUTH-FLOW] 3.3. ABP Login successful, fetching user profile...")
          const userSession = await createUserSession(tokenResponse, credentials.username as string)
          logger.info("[AUTH-FLOW] 3.4. Authorize hook complete, user session created.")
          return userSession
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          const baseUrl = config.api.baseUrl || process.env.NEXT_PUBLIC_API_URL || "unknown"

          if (errorMessage.toLowerCase().includes("invalid_grant")) {
            // Wrong credentials — return null → standard CredentialsSignin
            logger.warn(`Authorize: invalid credentials at ${baseUrl}`)
            return null
          }

          // Network / server error — throw with custom code so the login page
          // can show a connectivity error instead of "invalid credentials".
          // Auth.js forwards the code as ?code=ServerError in the redirect URL.
          //
          // Log the underlying OS-level cause if available (ECONNREFUSED, ENOTFOUND, TLS, etc.)
          const causeMessage = (err as { cause?: { message?: string } })?.cause?.message
          logger.warn(
            `Authorize: server/network error at ${baseUrl}: ${errorMessage}` +
              (causeMessage ? ` (cause: ${causeMessage})` : ""),
          )
          const serverError = new CredentialsSignin()
          serverError.code = "ServerError"
          throw serverError
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: unknown; user: unknown }) {
      // Initial sign-in: persist token data from authorize() into the JWT
      if (user) {
        logger.info("[AUTH-FLOW] 4. jwt() callback: Initial sign-in detected, persisting tokens into session cookie.")
        const u = user as {
          accessToken?: string
          refreshToken?: string
          expires_at?: number
          user?: ExtendedUser
        }

        // Slim user object to keep JWT cookie small (prevents HTTP 431)
        const slimUser = u.user ? slimUserForJWT(u.user) : undefined

        const baseToken = token as Record<string, unknown>
        return {
          accessToken: u.accessToken,
          refreshToken: u.refreshToken,
          expires_at: u.expires_at,
          user: slimUser,
          sub: baseToken.sub,
          email: baseToken.email,
          name: baseToken.name,
          picture: baseToken.picture,
        } as ExtendedJWT
      }

      const extendedToken = token as ExtendedJWT

      // If a previous refresh already failed, stop retrying — the client-side
      // AuthGuard / SessionExpiryBanner will detect the error and prompt re-login.
      // Without this guard, every middleware auth() call would retry the refresh
      // (because expires_at stays in the past), stacking 8-second timeouts.
      if (extendedToken.error) {
        return extendedToken
      }

      const bufferMs = TOKEN_REFRESH_BUFFER_SECONDS * 1000

      // Calculate refresh necessity once
      const shouldRefresh = extendedToken.expires_at && Date.now() > extendedToken.expires_at - bufferMs

      if (shouldRefresh && extendedToken.refreshToken) {
        return performRefresh(extendedToken)
      }

      return extendedToken
    },

    async session({ session, token }: { session: unknown; token: unknown }): Promise<ExtendedSession> {
      const s = session as { expires: string; [key: string]: unknown }
      const ext = token as ExtendedJWT

      const extendedSession: ExtendedSession = {
        ...s,
        accessToken: ext.accessToken,
        refreshToken: ext.refreshToken,
        expires_at: ext.expires_at,
        expires_in: ext.expires_at ? Math.max(0, Math.floor((ext.expires_at - Date.now()) / 1000)) : 0,
        user: (ext.user ?? {
          id: (ext.sub as string) ?? "",
          email: (ext.email as string) ?? undefined,
          name: (ext.name as string) ?? undefined,
        }) as ExtendedUser,
        error: ext.error,
      }

      return extendedSession
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: SESSION_MAX_AGE_SECONDS, // 8-hour session lifetime
    updateAge: JWT_UPDATE_AGE_SECONDS, // Re-sign JWT every 1 hour
  },
  /**
   * Override Auth.js's built-in logger.
   * CredentialsSignin is expected behaviour (wrong password OR server unreachable).
   * It is already logged at WARN level by our own logger inside authorize().
   * Printing Auth.js’s full stack trace for it is misleading noise — suppress it.
   * All other (unexpected) auth errors are forwarded to our logger at ERROR level.
   */
  logger: {
    error(error: Error) {
      // Suppress expected/handled errors that are already logged by our own logger:
      // - CredentialsSignin: handled in authorize() with logger.warn
      // - MissingCSRF: edge-case (tab already signed-out, stale request) — not actionable
      const suppressed = new Set(["CredentialsSignin", "MissingCSRF"])
      if (suppressed.has(error.name)) return
      logger.error("[auth] Unexpected error:", error.message)
    },
    warn(code: string) {
      logger.debug(`[auth] Warning: ${code}`)
    },
  },
  trustHost: true,
}

export const { auth, handlers } = NextAuth(authConfig as NextAuthConfig)
