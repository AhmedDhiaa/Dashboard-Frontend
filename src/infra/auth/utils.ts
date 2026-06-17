/**
 * Authentication Utility Functions
 *
 * Server-side session/token helpers and user-display formatting. Permission
 * checks live in PermissionContext (`isGranted`) — they are not duplicated here.
 */

import { auth } from "@/infra/auth/server"
import { getInitials } from "@/shared/utils/avatar"
import type { User, ExtendedSession } from "@/shared/types"

/**
 * Get the current server-side session (Auth.js v5)
 * Use this in Server Components and API routes
 */
export async function getSession() {
  return await auth()
}

/**
 * Get the access token from the session
 * Use this to make authenticated API requests
 */
export async function getAccessToken() {
  const session = await getSession()
  return (session as ExtendedSession | null)?.accessToken
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Guest"

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }

  if (user.firstName) {
    return user.firstName
  }

  if (user.name) {
    return user.name
  }

  return user.email || "User"
}

/**
 * Get user initials for avatar. Delegates to the shared `getInitials` so the
 * name→initials rule has one source of truth.
 */
export function getUserInitials(user: User | null | undefined): string {
  return getInitials(getUserDisplayName(user))
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expires_at: number): boolean {
  return Date.now() >= expires_at
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpirationTime(expiresIn: number): number {
  return Date.now() + expiresIn * 1000
}

/**
 * Format token for Authorization header
 */
export function formatAuthHeader(token: string, tokenType = "Bearer"): string {
  return `${tokenType} ${token}`
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(header: string): string | null {
  const parts = header.split(" ")
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] ?? null
  }
  return null
}
