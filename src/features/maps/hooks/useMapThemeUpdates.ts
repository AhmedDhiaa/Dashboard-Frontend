"use client"

import { useEffect } from "react"
import { logger } from "@/shared/logger"
import { getMapStyles } from "../utils/mapThemeStyles"
import type { MapInstance as ProviderMapInstance } from "../providers/Provider.interface"

/**
 * Hook to handle map theme updates when dark mode changes
 */
export function useMapThemeUpdates(map: ProviderMapInstance | null, isReady: boolean, isDarkMode: boolean) {
  useEffect(() => {
    if (!isReady || !map) return

    try {
      const nativeMap = map.getNativeInstance ? map.getNativeInstance() : map
      if (nativeMap && typeof nativeMap.setOptions === "function") {
        nativeMap.setOptions({ styles: getMapStyles(isDarkMode) })
      }
    } catch (error) {
      logger.error("[UnifiedMap] Failed to update map theme:", error)
    }
  }, [isDarkMode, isReady, map])
}
