"use client"

import type React from "react"
import { useEffect } from "react"
import type { AbstractIntlMessages } from "next-intl"
// eslint-disable-next-line no-restricted-imports -- Toaster mount point; toast calls go through @/hooks/useNotification
import { Toaster } from "sonner"
import { NextIntlClientProvider } from "next-intl"
import { ErrorBoundary } from "@/ui/application"
import { AuthProvider } from "@/infra/auth/components/AuthProvider"
import { SecureUserProvider } from "@/infra/auth/components/SecureUserProvider"
import { PermissionProvider } from "@/core/auth/context/PermissionContext"
import { SocketProvider } from "@/infra/socket/components/SocketProvider"
import { AuthGuard } from "@/infra/auth/components/AuthGuard"
import { SessionExpiryBanner } from "@/infra/auth/components/SessionExpiryBanner"
import { ThemeProvider as ThemeManagerProvider } from "@/ui/theme/ThemeManager"
import { ThemeProvider } from "@/ui/design-system/primitives/ThemeProvider"
import { setupGlobalErrorHandlers, QueryProvider } from "@/infra/api"
import { logger } from "@/shared/logger"
// Side-effect: drops recharts' inherent "width(-1)/height(-1)" first-frame dev
// warning (one per chart) that otherwise floods the console on chart-heavy
// pages. ChartFrame handles the real re-render thrash; this handles the noise.
import "@/shared/widgets/silence-recharts-resize-warning"

// Initialize entity configs synchronously at module load — registers lazy
// loaders so any page that calls `useEntityConfig(name)` finds the loader
// without racing the route navigation.
import { initializeEntityConfigs } from "@/core/entities/configs"
import { setEntityOverrideMap } from "@/core/entities/registry"
import type { EntityOverrideMap } from "@/core/entities/overrides/schema"
initializeEntityConfigs()

interface ClientProvidersProps {
  children: React.ReactNode
  locale: "en" | "ar"
  messages: AbstractIntlMessages
  entityOverrides: EntityOverrideMap
}

export function ClientProviders({ children, locale, messages, entityOverrides }: ClientProvidersProps) {
  // Apply admin overrides to the entity registry before any descendant
  // calls `getEntityConfig`. Runs both during SSR and client hydration —
  // identical input on both sides, so the merged config is hydration-safe.
  // Idempotent assignment, no useEffect needed.
  setEntityOverrideMap(entityOverrides)

  useEffect(() => {
    setupGlobalErrorHandlers()
  }, [])

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
        <SecureUserProvider>
          <PermissionProvider>
            <SocketProvider>
              <NextIntlClientProvider
                locale={locale}
                messages={messages}
                timeZone="UTC"
                onError={error => {
                  if (error.code === "MISSING_MESSAGE") {
                    if (process.env.NODE_ENV !== "production") {
                      logger.warn(`[i18n] Missing message: ${error.message}`)
                    }
                  } else if (!error.message.includes("INSUFFICIENT_PATH")) {
                    logger.warn("[i18n] error:", error.message)
                  }
                }}
                getMessageFallback={({ namespace, key }) => {
                  const fullKey = namespace ? `${namespace}.${key}` : key
                  const parts = fullKey.split(".")
                  return parts[parts.length - 1] || fullKey
                }}
              >
                <ThemeProvider>
                  <ThemeManagerProvider>
                    <SessionExpiryBanner />
                    <AuthGuard>{children}</AuthGuard>
                    {/*
                     * Toasts: top-center so the eye doesn't have to track to
                     * a corner mid-task. The unstyled Toaster ships a flat
                     * white pill — we apply our design-token defaults
                     * (rounded-lg, border, shadow-md, font-medium) and
                     * variant-specific accent on the start edge for
                     * success/error so they're scannable without colour-
                     * blindness traps (icon + colour bar, not colour alone).
                     */}
                    <Toaster
                      position="top-center"
                      gap={10}
                      theme="system"
                      toastOptions={{
                        duration: 4000,
                        classNames: {
                          toast:
                            "!bg-card !text-foreground !border !border-border !rounded-lg !shadow-md !px-4 !py-3 !text-sm !font-medium !max-w-md",
                          // Accent the start edge per variant so success/error are
                          // scannable by icon + colour bar (not colour alone).
                          success: "!border-s-4 !border-s-success",
                          error: "!border-s-4 !border-s-destructive",
                          loading: "!border-s-4 !border-s-primary",
                        },
                      }}
                    />
                  </ThemeManagerProvider>
                </ThemeProvider>
              </NextIntlClientProvider>
            </SocketProvider>
          </PermissionProvider>
        </SecureUserProvider>
      </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  )
}
