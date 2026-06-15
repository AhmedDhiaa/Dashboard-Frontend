/**
 * Authentication Types
 *
 * Type definitions for OAuth2 authentication flow, NextAuth session,
 * and application-level auth concerns (roles, permissions, guards).
 *
 * @module shared/types/auth.types
 */

import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"

// Permissions are flat ABP-style strings (e.g. "Api.BusinessPartner.Create")
// kept in `grantedPermissions: string[]`. Authorization is checked exclusively
// through PermissionContext.isGranted() — no resource/action object model.

// ─── Extended User ───────────────────────────────────────────────────────────

/**
 * Extended user object returned by the ABP application-configuration endpoint.
 * Used throughout client-side components and the NextAuth session.
 */
export interface ExtendedUser {
  id: string
  name?: string | null
  surName?: string | null
  email?: string | null
  image?: string | null
  userName?: string | null
  isAuthenticated?: boolean
  tenantId?: string | null
  impersonatorUserId?: string | null
  impersonatorTenantId?: string | null
  impersonatorUserName?: string | null
  impersonatorTenantName?: string | null
  emailVerified?: boolean
  phoneNumber?: string | null
  phoneNumberVerified?: boolean
  roles?: string[]
  roleNames?: string[]
  grantedPermissions?: string[]
  isActive?: boolean
  sessionId?: string | null
}

// ─── NextAuth Extensions ─────────────────────────────────────────────────────

/** Extended session with OAuth2 tokens and ABP user */
export interface ExtendedSession extends Session {
  accessToken?: string
  refreshToken?: string
  expires_at?: number
  expires_in?: number
  user: ExtendedUser
  error?: string
}

/** Extended JWT with OAuth2 tokens and ABP user */
export interface ExtendedJWT extends JWT {
  accessToken?: string
  refreshToken?: string
  expires_at?: number
  user?: ExtendedUser
  error?: string
}

// ─── OAuth2 Types ────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

export interface LoginRequest {
  username?: string
  email?: string
  password: string
  rememberMe?: boolean
}

export interface RefreshTokenRequest {
  refresh_token: string
}

// ─── Legacy User (client-side simplified) ────────────────────────────────────

export interface User {
  id: string
  username?: string
  email: string
  roles?: string[]
  name?: string
  firstName?: string
  lastName?: string
  avatar?: string
  grantedPermissions?: string[]
  isActive?: boolean
}
