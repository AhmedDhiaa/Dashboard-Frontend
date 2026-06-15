/**
 * Authentication Provider
 *
 * Wraps the app with NextAuth's SessionProvider configured for optimal
 * session management:
 * - Periodic session refetch to keep tokens fresh.
 * - Refetch on window focus so returning users get a valid session.
 *
 * @module infra/auth/components/AuthProvider
 */

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { SESSION_REFETCH_INTERVAL_SECONDS, SESSION_REFETCH_ON_WINDOW_FOCUS } from "@/infra/auth/auth-constants"

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={SESSION_REFETCH_INTERVAL_SECONDS}
      refetchOnWindowFocus={SESSION_REFETCH_ON_WINDOW_FOCUS}
    >
      {children}
    </SessionProvider>
  )
}
