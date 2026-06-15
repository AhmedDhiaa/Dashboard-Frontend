"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Field Renderers Library
 *
 * Centralized field rendering logic for consistent display across all CRUD pages.
 * Eliminates duplication by providing reusable renderers for common field types.
 */

import React from "react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { format } from "date-fns"
import { Check, X, Shield, MapPin } from "lucide-react"
import type { FieldValue } from "@/types/field-types"
import { useEnumContext, type EnumTypeName } from "@/core/enums"
import { useT } from "@/shared/config"
import dynamic from "next/dynamic"
import type { RendererColumnType } from "@/core/entities/column-types"

/**
 * Dynamic import for MapLocationRenderer to avoid architectural violations
 * (Layer 'ui' cannot statically import from 'features')
 */
const DynamicMapLocationRenderer = dynamic(
  () => import("@/features/maps/renderers/MapLocationRenderer").then(mod => mod.MapLocationRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse bg-muted rounded-xl flex items-center justify-center border border-border">
        <MapPin className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    ),
  },
)

export type FieldVariant = "default" | "primary" | "success" | "warning" | "danger" | "info"

export type FieldFormatter = "uppercase" | "lowercase" | "capitalize" | "truncate" | "phone" | "email"

/**
 * Renderer-side column-type union. Aliased to the master `RendererColumnType`
 * (see `src/core/entities/column-types.ts`) so this taxonomy cannot drift
 * from the entity-builder JSON taxonomy.
 */
export type FieldRendererType = RendererColumnType

export interface FieldRendererProps<T = Record<string, FieldValue>> {
  value: FieldValue
  type: FieldRendererType
  entity?: T
  config?: {
    className?: string
    dateFormat?: string
    currencySymbol?: string
    relationDisplay?: string
    variant?: FieldVariant
    formatter?: FieldFormatter
    maxLength?: number
    enumType?: string // Enum type name (e.g., "status", "entity-type")
    enumLocale?: "en" | "ar" // Locale for enum display
    mapHeight?: string // For map renderer
    mapZoom?: number // For map renderer
    customRender?: (value: FieldValue, entity?: T) => React.ReactNode
  }
}

/**
 * Format raw value based on formatter type
 */
function formatValue(value: FieldValue, formatter?: FieldFormatter, maxLength?: number): FieldValue | React.ReactNode {
  if (value === null || value === undefined) return value
  const str = String(value)

  switch (formatter) {
    case "uppercase":
      return str.toUpperCase()
    case "lowercase":
      return str.toLowerCase()
    case "capitalize":
      return str.charAt(0).toUpperCase() + str.slice(1)
    case "truncate":
      return str.length > (maxLength || 30) ? str.slice(0, maxLength || 30) + "..." : str
    case "email":
      return (
        <a href={`mailto:${str}`} className="text-primary hover:underline">
          {str}
        </a>
      )
    case "phone":
      return (
        <a href={`tel:${str}`} className="text-primary hover:underline">
          {str}
        </a>
      )
    default:
      return value
  }
}

/**
 * Convert FieldValue to safe React renderable type
 */
export function toReactRenderable(value: FieldValue | React.ReactNode): React.ReactNode {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && !React.isValidElement(value)) return JSON.stringify(value)
  return value as React.ReactNode
}

/**
 * Individual renderer functions for each field type
 */

const renderBadgeCode = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <Badge
    variant="outline"
    className={`font-mono text-xs border-primary/20 bg-primary/5 text-primary ${config?.className || ""}`}
  >
    {toReactRenderable(formattedValue)}
  </Badge>
)

const renderBadge = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => {
  const variantMap: Record<FieldVariant, string> = {
    default: "bg-muted/50 text-muted-foreground border-border",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success/10 text-success dark:text-success border-success/30",
    warning: "bg-warning/10 text-warning dark:text-warning border-warning/30",
    danger: "bg-destructive/10 text-destructive dark:text-destructive border-destructive/30",
    info: "bg-info/10 text-info dark:text-info border-info/30",
  }
  return (
    <Badge variant="outline" className={`${variantMap[config?.variant || "default"]} ${config?.className || ""}`}>
      {toReactRenderable(formattedValue)}
    </Badge>
  )
}

const renderTextPrimary = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <div className={`font-medium dark:text-white ${config?.className || ""}`}>{toReactRenderable(formattedValue)}</div>
)

const renderTextArabic = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <div className={`text-end font-arabic dark:text-white/70 ${config?.className || ""}`}>
    {toReactRenderable(formattedValue) || "-"}
  </div>
)

function InvalidDate() {
  const t = useT("common")
  return <span className="text-muted-foreground text-sm">{t("fields.invalid_date")}</span>
}

const renderTextSecondary = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <div className={`text-sm text-muted-foreground ${config?.className || ""}`}>{toReactRenderable(formattedValue)}</div>
)

const renderDate = (value: FieldValue, config: FieldRendererProps["config"]) => {
  try {
    const dateFormat = config?.dateFormat || "MMM dd, yyyy"
    const dateValue =
      typeof value === "string" || typeof value === "number" || value instanceof Date ? value : String(value)
    return (
      <div className={`text-xs dark:text-white/70 ${config?.className || ""}`}>
        {format(new Date(dateValue), dateFormat)}
      </div>
    )
  } catch {
    return <InvalidDate />
  }
}

const renderDateTime = (value: FieldValue, config: FieldRendererProps["config"]) => {
  try {
    const datetimeFormat = config?.dateFormat || "MMM dd, yyyy HH:mm"
    const dateValue =
      typeof value === "string" || typeof value === "number" || value instanceof Date ? value : String(value)
    return (
      <div className={`text-xs dark:text-white/70 ${config?.className || ""}`}>
        {format(new Date(dateValue), datetimeFormat)}
      </div>
    )
  } catch {
    return <InvalidDate />
  }
}

const renderBoolean = (value: FieldValue, config: FieldRendererProps["config"]) => (
  <div className={`flex items-center gap-1 ${config?.className || ""}`}>
    {value ? (
      <>
        <Check className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-600 dark:text-green-500">Yes</span>
      </>
    ) : (
      <>
        <X className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600 dark:text-red-500">No</span>
      </>
    )}
  </div>
)

const renderSystemBoolean = (value: FieldValue, config: FieldRendererProps["config"]) => (
  <div className={`flex items-center gap-1.5 ${config?.className || ""}`}>
    {value ? (
      <Badge
        variant="outline"
        className="bg-info/10 text-info dark:text-info border-info/30 flex items-center gap-1 py-0.5"
      >
        <Shield className="h-3 w-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">System</span>
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="bg-destructive/10 text-destructive dark:text-destructive border-destructive/30 flex items-center gap-1 py-0.5"
      >
        <X className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Not System</span>
      </Badge>
    )}
  </div>
)

const renderRelation = (value: FieldValue, config: FieldRendererProps["config"]) => {
  const displayField = config?.relationDisplay || "name"
  const displayValue =
    typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
      ? (value as Record<string, unknown>)[displayField]
      : value
  return (
    <div className={`dark:text-white/70 ${config?.className || ""}`}>
      {toReactRenderable(displayValue as FieldValue) || "-"}
    </div>
  )
}

const renderBadgeStatus = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <Badge variant="secondary" className={config?.className}>
    {toReactRenderable(formattedValue)}
  </Badge>
)

const renderNumber = (value: FieldValue, config: FieldRendererProps["config"]) => (
  <div className={`font-mono text-sm ${config?.className || ""}`}>
    {typeof value === "number" ? value.toLocaleString() : toReactRenderable(value)}
  </div>
)

const renderCurrency = (value: FieldValue, config: FieldRendererProps["config"]) => {
  const symbol = config?.currencySymbol || " IQD "
  const amount =
    typeof value === "number"
      ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : toReactRenderable(value)
  return (
    <div className={`font-mono text-sm ${config?.className || ""}`}>
      {symbol}
      {amount}
    </div>
  )
}

/**
 * Render Map Location
 */
const renderMapLocation = (value: FieldValue, config: FieldRendererProps["config"]) => {
  return <DynamicMapLocationRenderer value={value} config={config} />
}

/**
 * Enum Renderer Component
 */
function EnumRenderer({ value, config }: { value: FieldValue; config: FieldRendererProps["config"] }) {
  const { getEnumValue } = useEnumContext()
  const t = useT()

  if (typeof value !== "number" || !config?.enumType) {
    return <span className="text-muted-foreground text-sm">{String(value)}</span>
  }

  const enumValue = getEnumValue(config.enumType as EnumTypeName, value)
  if (!enumValue) return <span className="text-muted-foreground text-sm">{String(value)}</span>

  // Priority: 1. Backend localization name, 2. Local fallback Enum.{type}.{name}, 3. direct name
  const translationKey = enumValue.localization?.name || `Enum.${config.enumType}.${enumValue.name}`
  const label = t(translationKey)

  return (
    <Badge variant="outline" className={`bg-primary/5 text-primary border-primary/20 ${config?.className || ""}`}>
      {label || enumValue.name}
    </Badge>
  )
}

const renderEnum = (value: FieldValue, config: FieldRendererProps["config"]) => {
  return <EnumRenderer value={value} config={config} />
}

const renderCustom = (
  formattedValue: FieldValue | React.ReactNode,
  config: FieldRendererProps["config"],
  entity?: unknown,
) => {
  if (config?.customRender) {
    const renderValue = formattedValue instanceof Date ? formattedValue.toISOString() : formattedValue
    return <>{config.customRender(renderValue as FieldValue, entity as Record<string, FieldValue> | undefined)}</>
  }
  return <div>{toReactRenderable(formattedValue)}</div>
}

const renderDefault = (formattedValue: FieldValue | React.ReactNode, config: FieldRendererProps["config"]) => (
  <div className={config?.className}>{toReactRenderable(formattedValue)}</div>
)

/**
 * Renderer registry - maps field types to renderer functions
 */
type RendererFunction = (
  value: FieldValue | React.ReactNode,
  config: FieldRendererProps["config"],
  entity?: unknown,
) => React.ReactNode

const rendererRegistry: Record<FieldRendererType, RendererFunction> = {
  "badge-code": renderBadgeCode,
  badge: renderBadge,
  "text-primary": renderTextPrimary,
  "text-arabic": renderTextArabic,
  "text-secondary": renderTextSecondary,
  date: (value, config) => renderDate(value as FieldValue, config),
  datetime: (value, config) => renderDateTime(value as FieldValue, config),
  boolean: (value, config) => renderBoolean(value as FieldValue, config),
  "boolean-system": (value, config) => renderSystemBoolean(value as FieldValue, config),
  relation: (value, config) => renderRelation(value as FieldValue, config),
  "badge-status": renderBadgeStatus,
  number: (value, config) => renderNumber(value as FieldValue, config),
  currency: (value, config) => renderCurrency(value as FieldValue, config),
  enum: (value, config) => renderEnum(value as FieldValue, config),
  "map-location": (value, config) => renderMapLocation(value as FieldValue, config),
  custom: renderCustom,
  button: (value, config) => renderDefault(value, config),
  "action-button": (value, config) => renderDefault(value, config),
}

/**
 * Main field renderer component - now using Strategy Pattern
 */
export function FieldRenderer({ value, type, entity: _entity, config = {} }: FieldRendererProps) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  // Apply formatter if specified
  const formattedValue = formatValue(value, config.formatter, config.maxLength)

  // Get renderer from registry or use default
  const renderer = rendererRegistry[type] || renderDefault

  // Execute renderer
  return <>{renderer(formattedValue, config, _entity)}</>
}
