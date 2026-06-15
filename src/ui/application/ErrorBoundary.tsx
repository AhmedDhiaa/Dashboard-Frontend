"use client"

import React from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { AlertTriangle } from "lucide-react"
import { useT } from "@/shared/config"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

// Functional fallback so it can read translations via the useT hook.
// (The boundary itself is a class component because getDerivedStateFromError
// requires class semantics — class components can't call hooks directly.)
function DefaultErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const t = useT()
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{t("errors.500_title")}</p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-2 text-xs text-muted-foreground text-start max-w-md overflow-auto">{error?.message}</pre>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        {t("common.image_uploader.try_again")}
      </Button>
    </div>
  )
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ReactNode; onError?: (e: Error) => void }>,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error)
    if (typeof window !== "undefined") {
      // Two reports: the existing structured log line (for the unified
      // logger pipeline), and a captureException to the error reporter
      // which is the path that Sentry / Datadog adapters hook into.
      void Promise.all([
        import("@/shared/logger").then(({ logger }) =>
          logger.error("React ErrorBoundary caught error", {
            error: error.message,
            componentStack: info.componentStack,
          }),
        ),
        import("@/infra/observability/error-reporter").then(({ errorReporter }) =>
          errorReporter.captureException(error, {
            tags: { source: "react-error-boundary" },
            extra: { componentStack: info.componentStack },
          }),
        ),
      ])
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return <DefaultErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false })} />
    }
    return this.props.children
  }
}
