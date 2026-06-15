"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * App Shell Skeleton
 *
 * Full-page loading skeleton that mirrors the dashboard layout.
 * Shown by AuthGuard while the session is being verified.
 * Using CSS animations (no JS) for maximum performance.
 */

import { useT } from "@/shared/config"

export function AppShellSkeleton() {
  const t = useT("auth")
  return (
    <div className="flex min-h-screen bg-background" aria-hidden="true" aria-label={t("loading_application")}>
      {/* Sidebar ghost */}
      <div className="hidden md:flex flex-col w-60 shrink-0 border-e border-border/50 bg-muted/10 p-4 gap-3">
        <div className="h-8 w-32 rounded-lg bg-muted/60 animate-pulse mb-4" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-muted/40 animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar ghost */}
        <div className="h-14 border-b border-border/50 bg-muted/10 flex items-center px-6 gap-4">
          <div className="h-6 w-40 rounded-md bg-muted/50 animate-pulse" />
          <div className="flex-1" />
          <div className="h-8 w-8 rounded-full bg-muted/50 animate-pulse" />
        </div>

        {/* Content ghost */}
        <div className="flex-1 p-6 space-y-4">
          <div className="h-8 w-56 rounded-lg bg-muted/50 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
