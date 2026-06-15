/**
 * Custom Map Controls - Modern Glassmorphism Design
 * Optimized for performance and accessibility
 */

"use client"

import "./map-controls.css"
import { logger } from "@/shared/logger"
import { X, Pentagon, Circle, MapPin, Navigation, Trash2, Search, Crosshair } from "lucide-react"
import { cn } from "@/shared/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import { useT } from "@/shared/config/i18n"

interface MapControlsProps {
  /** Toggle map type handler */
  onToggleMapType?: () => void

  /** Current map type */
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain"

  /** Recenter map handler */
  onRecenter?: () => void

  /** Fit to bounds handler */
  onFitBounds?: () => void

  /** Start drawing handler (edit mode) */
  onStartDrawing?: (mode?: "polygon" | "circle") => void

  /** Stop drawing handler */
  onStopDrawing?: () => void

  /** Clear boundary handler */
  onClearBoundary?: () => void

  /** Whether currently drawing */
  isDrawing?: boolean

  /** Show drawing controls */
  showDrawingControls?: boolean

  /** Has boundary */
  hasBoundary?: boolean

  /** Toggle expand/collapse handler */
  onToggleExpand?: () => void

  /** Is expanded state */
  isExpanded?: boolean

  /** Toggle search handler */
  onToggleSearch?: () => void

  /** Show search control */
  showSearchControl?: boolean

  /** Show search state */
  showSearch?: boolean

  /** Pick location handler */
  onPickLocation?: () => void

  /** Is picking location */
  isPickingLocation?: boolean

  /** Clear boundaries handler (from parent) */
  onClear?: () => void
}

function DrawingControls({
  onStartDrawing,
  onStopDrawing,
  onClearBoundary,
  onClear,
  isDrawing,
  hasBoundary,
}: Pick<
  MapControlsProps,
  "onStartDrawing" | "onStopDrawing" | "onClearBoundary" | "onClear" | "isDrawing" | "hasBoundary"
>) {
  const t = useT("map")

  return (
    <>
      {!isDrawing ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onStartDrawing?.("polygon")}
                className="map-control-btn draw-polygon"
                aria-label={t("controls.drawPolygon")}
              >
                <Pentagon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{t("controls.drawPolygon")}</p>
              <p className="text-[10px] opacity-70">{t("controls.drawPolygonHint")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onStartDrawing?.("circle")}
                className="map-control-btn draw-circle"
                aria-label={t("controls.drawCircle")}
              >
                <Circle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{t("controls.drawCircle")}</p>
              <p className="text-[10px] opacity-70">{t("controls.drawCircleHint")}</p>
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onStopDrawing}
              className="map-control-btn destructive drawing"
              aria-label={t("controls.cancelDrawing")}
            >
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t("controls.cancelDrawing")}</p>
            <p className="text-[10px] opacity-70">{t("controls.pressEsc")}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {hasBoundary && (
        <>
          <div className="map-control-divider" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClear || onClearBoundary}
                className="map-control-btn destructive"
                aria-label={t("controls.clearBoundary")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{t("controls.clearBoundary")}</p>
              <p className="text-[10px] opacity-70">{t("controls.clearBoundaryHint")}</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
      <div className="map-control-divider" />
    </>
  )
}

export function MapControls({
  onRecenter,
  onFitBounds,
  onStartDrawing,
  onStopDrawing,
  onClearBoundary,
  isDrawing = false,
  showDrawingControls = false,
  hasBoundary = false,
  onToggleSearch,
  showSearchControl = false,
  showSearch = false,
  onPickLocation,
  isPickingLocation = false,
  onClear,
}: MapControlsProps) {
  const t = useT("map")

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute top-4 start-1/2 -translate-x-1/2 z-10">
        <div className="map-controls-container flex flex-row gap-1.5">
          {/* Drawing Controls */}
          {showDrawingControls && (
            <DrawingControls
              onStartDrawing={onStartDrawing}
              onStopDrawing={onStopDrawing}
              onClearBoundary={onClearBoundary}
              onClear={onClear}
              isDrawing={isDrawing}
              hasBoundary={hasBoundary}
            />
          )}

          {/* Location Picker Control */}
          {onPickLocation && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      logger.warn("[MapControls] Location picker clicked, isPickingLocation:", isPickingLocation)
                      onPickLocation()
                    }}
                    className={cn("map-control-btn", isPickingLocation && "active")}
                    aria-label={t("controls.pickLocation")}
                    aria-pressed={isPickingLocation}
                  >
                    <Crosshair className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{t("controls.pickLocation")}</p>
                  <p className="text-[10px] opacity-70">{t("controls.pickLocationHint")}</p>
                </TooltipContent>
              </Tooltip>
              <div className="map-control-divider" />
            </>
          )}

          {/* View Controls */}
          <div className="flex flex-row gap-1">
            {hasBoundary && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onFitBounds}
                    className="map-control-btn"
                    aria-label={t("controls.focusArea")}
                  >
                    <MapPin className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{t("controls.focusArea")}</p>
                  <p className="text-[10px] opacity-70">{t("controls.focusAreaHint")}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRecenter}
                  className="map-control-btn"
                  aria-label={t("controls.myLocation")}
                >
                  <Navigation className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{t("controls.myLocation")}</p>
                <p className="text-[10px] opacity-70">{t("controls.myLocationHint")}</p>
              </TooltipContent>
            </Tooltip>

            {showSearchControl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleSearch}
                    className={cn("map-control-btn", showSearch && "active")}
                    aria-label={t("controls.search")}
                    aria-pressed={showSearch}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{t("controls.search")}</p>
                  <p className="text-[10px] opacity-70">{t("controls.searchHint")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
