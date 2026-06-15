"use client"

import { memo } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Alert, AlertDescription } from "@/ui/design-system/primitives/alert"
import { useT } from "@/shared/config"

/**
 * Map Loading Overlay Component
 */
export const MapLoadingOverlay = memo(
  ({
    isLoading,
    isReady,
    error,
    onRetry,
  }: {
    isLoading: boolean
    isReady: boolean
    error: Error | null
    onRetry: () => void
  }) => {
    const t = useT("map")
    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm z-50">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium">{error.message}</p>
                <div className="text-xs opacity-75">
                  <p>• Check browser console for detailed logs</p>
                  <p>{t("status.api_key_check")}</p>
                  <p>{t("status.network_check")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={onRetry} className="w-full">
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    if ((isLoading || !isReady) && !error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30 backdrop-blur-sm z-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">{t("status.loading")}</p>
            <p className="text-xs text-muted-foreground">{t("status.may_take_seconds")}</p>
          </div>
        </div>
      )
    }

    return null
  },
)

MapLoadingOverlay.displayName = "MapLoadingOverlay"
