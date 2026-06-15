"use client"

import React from "react"
import { Controller, type Control, type FieldValues, type ControllerRenderProps } from "react-hook-form"
import { FormControl, FormItem, FormMessage, FormLabel } from "@/ui/design-system/primitives/form"
import { Card } from "@/ui/design-system/primitives/card"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Button } from "@/ui/design-system/primitives/button"
import dynamic from "next/dynamic"
import { MapPin, ChevronDown, ChevronUp, Copy, CheckCircle2, Map as MapIcon, Navigation, Pentagon } from "lucide-react"

// Lazy-load the maps subsystem so core/crud doesn't statically depend on
// features/maps. SSR is disabled because UnifiedMap pulls in browser-only
// google.maps APIs; rendering on the server would crash.
const UnifiedMap = dynamic(() => import("@/features/maps/UnifiedMap").then(m => m.UnifiedMap), { ssr: false })
import { logger } from "@/shared/logger"
import { cn } from "@/shared/utils"
import type {
  BoundaryFieldContentProps,
  BoundaryFieldHeaderProps,
  BoundaryInfoSectionProps,
  BoundaryMapContainerProps,
  BoundaryPointCardProps,
  MapStatusDisplayProps,
  PointManualInputsProps,
} from "./BoundaryDrawerField.types"
import { buildMapFeatures } from "./BoundaryDrawerField.utils"

/**
 * Coordinate input component for manual entry
 */
function CoordinateField({
  control,
  name,
  label,
  disabled,
  min,
  max,
}: {
  control: Control<FieldValues>
  name: string
  label: string
  disabled?: boolean
  min?: number
  max?: number
}) {
  return (
    <div>
      <FormLabel className="text-xs font-medium">{label}</FormLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
          <FormItem>
            <FormControl>
              <input
                {...field}
                value={field.value ?? ""}
                type="number"
                step="any"
                min={min}
                max={max}
                disabled={disabled}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "transition-all duration-200",
                )}
                onChange={e => {
                  const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                  field.onChange(value)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

export const BoundaryPointCard = React.memo<BoundaryPointCardProps>(({ point, index, copiedIndex, onCopy, t }) => (
  <div className="group relative flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors border border-transparent hover:border-border">
    <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
      {index + 1}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-mono text-muted-foreground truncate">{point.latitude.toFixed(6)}</div>
      <div className="text-[10px] font-mono text-muted-foreground truncate">{point.longitude.toFixed(6)}</div>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onCopy(point, index)}
      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      title={t("common.copy") || "Copy"}
    >
      {copiedIndex === index ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  </div>
))

BoundaryPointCard.displayName = "BoundaryPointCard"

export const BoundaryInfoSection = React.memo<BoundaryInfoSectionProps>(
  ({ boundaries, showPointsList, isExpanded, onToggleExpanded, onCopyCoordinate, copiedIndex, t }) => (
    <>
      {/* Info Display - Points Count and Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
          <MapPin className="h-3.5 w-3.5" />
          <span className="font-semibold">{boundaries.length}</span>
          <span className="text-muted-foreground">
            {boundaries.length === 1 ? t("common.point") || "Point" : t("common.points") || "Points"}
          </span>
        </Badge>

        {showPointsList && (
          <Button type="button" variant="outline" size="sm" onClick={onToggleExpanded} className="h-8 px-3">
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 me-1.5" />
                {t("common.hide") || "Hide"}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 me-1.5" />
                {t("common.show") || "Show"}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Boundary Points List (Collapsible & Modern Grid) */}
      {showPointsList && isExpanded && (
        <Card className="border-2 overflow-hidden">
          <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">{t("pages.boundaries_list") || "Boundary Coordinates"}</h4>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
              {boundaries.map((point, index) => (
                <BoundaryPointCard
                  key={index}
                  point={point}
                  index={index}
                  copiedIndex={copiedIndex}
                  onCopy={onCopyCoordinate}
                  t={t}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  ),
)

BoundaryInfoSection.displayName = "BoundaryInfoSection"

export const BoundaryFieldHeader = React.memo<BoundaryFieldHeaderProps>(
  ({ label, description, required, showMap, onToggleMap, t }) => (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <FormLabel className="text-sm font-medium text-foreground dark:text-foreground">
          {label}
          {required && <span className="text-destructive ms-1">*</span>}
        </FormLabel>
        {description && (
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant={showMap ? "outline" : "default"}
        size="sm"
        onClick={onToggleMap}
      >
        {showMap ? (
          <>
            <MapIcon className="h-4 w-4 me-2" />
            {t("common.hide") || "Hide Map"}
          </>
        ) : (
          <>
            <Pentagon className="h-4 w-4 me-2" />
            {t("common.actions.draw") || "Draw Boundary"}
          </>
        )}
      </Button>
    </div>
  ),
)

BoundaryFieldHeader.displayName = "BoundaryFieldHeader"

export const PointManualInputs = React.memo<PointManualInputsProps>(
  ({ pointFields, control, showCurrentLocation, onGetCurrentLocation, t }) => (
    <>
      <div className="grid grid-cols-3 gap-4">
        <CoordinateField control={control} name={pointFields.longitude} label="Longitude" min={-180} max={180} />
        <CoordinateField control={control} name={pointFields.latitude} label="Latitude" min={-90} max={90} />
        {pointFields.angle && (
          <CoordinateField control={control} name={pointFields.angle} label="Angle" min={0} max={360} />
        )}
        {showCurrentLocation && onGetCurrentLocation && (
          <Button type="button" variant="outline" size="sm" onClick={onGetCurrentLocation} className="mt-6">
            <Navigation className="h-4 w-4 me-2" />
            {t("common.currentLocation") || "Current Location"}
          </Button>
        )}
      </div>
    </>
  ),
)

PointManualInputs.displayName = "PointManualInputs"

export const MapStatusDisplay = React.memo<MapStatusDisplayProps>(({ mode, showMap, boundaries }) => {
  if (showMap) return null

  if (mode === "boundary" && boundaries && boundaries.length > 0) {
    return (
      <div className="px-4 py-2 bg-muted text-foreground border border-border rounded-xl flex items-center gap-2 text-sm font-medium w-fit">
        <MapIcon className="h-4 w-4 text-primary" />
        Boundary: {boundaries.length} points
      </div>
    )
  }

  return null
})

MapStatusDisplay.displayName = "MapStatusDisplay"

export const BoundaryMapContainer = ({
  mode,
  mapHeight,
  center,
  zoom,
  mapControls,
  fillColor,
  strokeColor,
  polygonData,
  pointLocation,
  onSearchResult,
  onDrawingComplete,
  onBoundaryChange,
  onLocationPicked,
  onClear,
}: BoundaryMapContainerProps) => {
  const enabled = !!polygonData && polygonData.length > 0

  logger.debug(
    `[BoundaryDrawerField] Rendering map - polygonData.length: ${polygonData?.length || 0}, enabled: ${enabled}`,
  )

  // Log the actual polygon data for debugging
  if (enabled && polygonData) {
    logger.debug(`[BoundaryDrawerField] First point:`, polygonData[0])
  }

  const features = buildMapFeatures(
    mode,
    pointLocation,
    polygonData,
    mapControls,
    fillColor,
    strokeColor,
    onLocationPicked,
    onDrawingComplete,
    onBoundaryChange,
  )

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div style={{ height: mapHeight }}>
        <UnifiedMap
          center={center}
          zoom={zoom}
          minZoom={5}
          maxZoom={20}
          showDrawingControls={mapControls.showDrawing}
          showSearchControl={mapControls.showSearch}
          onSearchResult={onSearchResult}
          onLocationPicked={onLocationPicked}
          onClear={onClear}
          features={features}
        />
      </div>
    </div>
  )
}

BoundaryMapContainer.displayName = "BoundaryMapContainer"

export const BoundaryFieldContent = React.memo<BoundaryFieldContentProps>(
  ({
    mode,
    label,
    description,
    required,
    showMap,
    boundaries,
    pointLocation,
    pointFields,
    showManualInputs,
    showCurrentLocation,
    showPointsList,
    isPointsListExpanded,
    copiedIndex,
    mapHeight,
    center,
    zoom,
    mapControls,
    fillColor,
    strokeColor,
    polygonData,
    control,
    onToggleMap,
    onClearBoundaries,
    onGetCurrentLocation,
    onToggleExpanded,
    onCopyCoordinate,
    onSearchResult,
    onDrawingComplete,
    onBoundaryChange,
    onLocationPicked,
    t,
    fieldState,
  }) => (
    <div className="space-y-5">
      {/* Header with Toggle Button */}
      <BoundaryFieldHeader
        label={label}
        description={description}
        required={required}
        showMap={showMap}
        onToggleMap={onToggleMap}
        t={t}
      />

      {/* Manual Coordinate Inputs for Point Mode */}
      {mode === "point" && showManualInputs && pointFields && (
        <PointManualInputs
          pointFields={pointFields}
          control={control}
          showCurrentLocation={showCurrentLocation}
          onGetCurrentLocation={onGetCurrentLocation}
          t={t}
        />
      )}

      {/* Status Display when map is hidden */}
      <MapStatusDisplay mode={mode} showMap={showMap} boundaries={boundaries} />

      {/* Info Display and Points List (boundary mode only) */}
      {showMap && mode === "boundary" && boundaries && boundaries.length > 0 && (
        <BoundaryInfoSection
          boundaries={boundaries}
          showPointsList={showPointsList}
          isExpanded={isPointsListExpanded}
          onToggleExpanded={onToggleExpanded}
          onCopyCoordinate={onCopyCoordinate}
          copiedIndex={copiedIndex}
          t={t}
        />
      )}

      {/* Map Container */}
      {showMap && (
        <BoundaryMapContainer
          mode={mode}
          mapHeight={mapHeight}
          center={center}
          zoom={zoom}
          mapControls={mapControls}
          fillColor={fillColor}
          strokeColor={strokeColor}
          polygonData={polygonData}
          pointLocation={pointLocation}
          onSearchResult={onSearchResult}
          onDrawingComplete={onDrawingComplete}
          onBoundaryChange={onBoundaryChange}
          onLocationPicked={onLocationPicked}
          onClear={onClearBoundaries}
        />
      )}

      {fieldState.error && <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>}
    </div>
  ),
)

BoundaryFieldContent.displayName = "BoundaryFieldContent"
