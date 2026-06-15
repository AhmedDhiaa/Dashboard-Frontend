/**
 * BoundaryDrawerField - Reusable form field component for storing and displaying polygon boundaries
 *
 * This is a storage-only component that integrates with react-hook-form.
 * The actual drawing controls are on the map itself (configured via mapControls prop).
 *
 * @example
 * ```tsx
 * <BoundaryDrawerField
 *   name="boundaries"
 *   label="City Boundaries"
 *   center={{ lat: 24.7136, lng: 46.6753 }}
 *   mapControls={{
 *     showDrawing: true,
 *     showSearch: true,
 *     showAddPoint: false,
 *   }}
 * />
 * ```
 */
"use client"

import { useFormContext, Controller } from "react-hook-form"
import { FormControl, FormItem, FormMessage } from "@/ui/design-system/primitives/form"
import { useT } from "@/shared/config"
import type { BoundaryDrawerFieldProps } from "./BoundaryDrawerField.types"
import { BoundaryFieldContent } from "./BoundaryDrawerField.parts"
import {
  useBoundaryFieldState,
  useBoundaryHandlers,
  useCombinedLocationPicker,
  usePointHandlers,
} from "./BoundaryDrawerField.hooks"
import { validateBoundaryFieldProps } from "./BoundaryDrawerField.utils"

export type { BoundaryDrawerFieldProps, BoundaryPoint, MapControlsConfig } from "./BoundaryDrawerField.types"

export function BoundaryDrawerField({
  mode = "boundary",
  name,
  pointFields,
  label,
  description,
  required = false,
  center = { lat: 33.3152, lng: 44.3661 }, // Baghdad, Iraq
  zoom = 10,
  mapHeight = "500px",
  fillColor = "#3b82f6",
  strokeColor = "#1e40af",
  showPointsList = true,
  showManualInputs = false,
  showCurrentLocation = false,
  mapControls = { showDrawing: true, showSearch: false, showAddPoint: false },
}: BoundaryDrawerFieldProps) {
  const t = useT()
  const { control, setValue, watch } = useFormContext()

  // Validate props based on mode
  validateBoundaryFieldProps(mode, name, pointFields)

  // Manage component state
  const {
    isPointsListExpanded,
    setIsPointsListExpanded,
    copiedIndex,
    showMap,
    setShowMap,
    boundaries,
    polygonData,
    pointLocation,
    handleCopyCoordinate,
  } = useBoundaryFieldState(mode, name, pointFields, watch)

  // Use custom hooks for handlers
  const boundaryHandlers = useBoundaryHandlers(name, setValue)
  const pointHandlers = usePointHandlers(pointFields, setValue)

  // Create a combined location picker handler that works for both modes
  const handleLocationPicked = useCombinedLocationPicker(
    mode,
    name,
    boundaries,
    setValue,
    pointHandlers.handleLocationPicked,
  )

  return (
    <Controller
      name={(mode === "boundary" ? name : pointFields?.longitude) || ""}
      control={control}
      render={({ field: _field, fieldState }) => (
        <FormItem>
          <FormControl>
            <div className="rounded-xl border border-border bg-card p-6">
              <BoundaryFieldContent
                mode={mode}
                label={label}
                description={description}
                required={required}
                showMap={showMap}
                boundaries={boundaries}
                pointLocation={pointLocation}
                pointFields={pointFields}
                showManualInputs={showManualInputs}
                showCurrentLocation={showCurrentLocation}
                showPointsList={showPointsList}
                isPointsListExpanded={isPointsListExpanded}
                copiedIndex={copiedIndex}
                mapHeight={mapHeight}
                center={center}
                zoom={zoom}
                mapControls={mapControls}
                fillColor={fillColor}
                strokeColor={strokeColor}
                polygonData={polygonData}
                control={control}
                onToggleMap={() => setShowMap(!showMap)}
                onClearBoundaries={
                  mode === "boundary" ? boundaryHandlers.handleClearBoundaries : pointHandlers.handleClearPoint
                }
                onGetCurrentLocation={pointHandlers.handleGetCurrentLocation}
                onToggleExpanded={() => setIsPointsListExpanded(!isPointsListExpanded)}
                onCopyCoordinate={handleCopyCoordinate}
                onSearchResult={boundaryHandlers.handleSearchResult}
                onDrawingComplete={boundaryHandlers.handleDrawingComplete}
                onBoundaryChange={boundaryHandlers.handleBoundaryChange}
                onLocationPicked={handleLocationPicked}
                t={t}
                fieldState={fieldState}
              />
            </div>
          </FormControl>

          {fieldState.error && <FormMessage>{fieldState.error.message}</FormMessage>}
        </FormItem>
      )}
    />
  )
}
