"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Base Detail Renderer Component
 *
 * Eliminates 80% duplication in detail pages by providing metadata-driven rendering.
 * Renders entity details in consistent card-based sections.
 */

import React from "react"
import { getNestedValue } from "@/shared/utils"
import {
  FieldRenderer,
  type FieldRendererType,
  type FieldVariant,
  type FieldFormatter,
} from "@/ui/crud/renderers/field-renderers"
import { useT } from "@/shared/config"
import { Clock } from "lucide-react"
import { getRegisteredSection } from "@/ui/crud/renderers/detail-section-registry"
import type { FieldValue } from "@/types/field-types"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"

export interface FieldConfig {
  name: string
  type?: FieldRendererType
  label?: string
  labelKey?: string
  render?: (value: unknown, entity: Record<string, unknown>) => React.ReactNode
  condition?: (entity: Record<string, unknown>) => boolean
  /** ABP permission key; when set and not granted (and not admin), the field is hidden. */
  requiredPermission?: string
  config?: {
    dateFormat?: string
    currencySymbol?: string
    relationDisplay?: string
    variant?: FieldVariant
    formatter?: FieldFormatter
    maxLength?: number
    enumType?: string
    enumLocale?: "en" | "ar"
    mapHeight?: string
    mapZoom?: number
  }
}

export interface DetailSection {
  title?: string
  titleKey?: string
  icon?: React.ReactNode
  fields: (FieldConfig | string)[]
  className?: string
  condition?: (entity: Record<string, unknown>) => boolean
}

export interface BaseDetailRendererProps<T = Record<string, unknown>> {
  entity: T
  sections: (DetailSection | string)[]
  customSections?: React.ReactNode
  loading?: boolean
}

/**
 * Base Detail Renderer Component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BaseDetailRenderer<T extends Record<string, any>>({
  entity,
  sections,
  customSections,
  loading = false,
}: BaseDetailRendererProps<T>) {
  const t = useT()

  if (loading) {
    return (
      <div className="space-y-6">
        <DetailGrid>
          {sections.map((_, index) => (
            <div key={index} className="animate-in fade-in duration-300" style={{ animationDelay: `${index * 80}ms` }}>
              {/* Skeleton Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-muted/50 animate-pulse" />
                <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
              </div>

              {/* Skeleton Content */}
              <div className="p-5 rounded-xl border border-border bg-card space-y-5">
                {[1, 2, 3].map(fieldIdx => (
                  <div key={fieldIdx} className="space-y-2">
                    <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                    <div className="h-10 bg-muted/30 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </DetailGrid>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DetailGrid>
        {sections.map((sectionOrId, sectionIdx) => (
          <DetailSectionItem key={sectionIdx} sectionOrId={sectionOrId} entity={entity} t={t} />
        ))}
      </DetailGrid>

      {customSections}
    </div>
  )
}

/**
 * Component to render a single detail section
 */
function DetailSectionItem({
  sectionOrId,
  entity,
  t,
}: {
  sectionOrId: DetailSection | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: Record<string, any>
  t: (key: string) => string
}) {
  const section: DetailSection =
    typeof sectionOrId === "string" ? (getRegisteredSection(sectionOrId) as DetailSection) : sectionOrId

  if (section.condition && !section.condition(entity)) return null

  return (
    <div className={section.className}>
      {/* Section Header - Clean and Simple */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
          {section.icon &&
            (React.isValidElement(section.icon)
              ? section.icon
              : React.createElement(section.icon as unknown as React.ComponentType<{ className: string }>, {
                  className: "h-5 w-5 text-primary",
                }))}
          {!section.icon && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        <div>
          <h3 className="font-bold text-base text-foreground">
            {section.titleKey ? t(section.titleKey) : section.title ? t(`pages.${section.title}`) : ""}
          </h3>
        </div>
      </div>

      {/* Section Content - Clean Card */}
      <div className="space-y-5 p-5 rounded-xl border border-border bg-card transition-colors duration-200 hover:border-foreground/15">
        {section.fields.map((fieldConfig, fieldIndex) => (
          <DetailFieldItem key={fieldIndex} fieldConfig={fieldConfig} entity={entity} t={t} />
        ))}
      </div>
    </div>
  )
}

/**
 * Component to render a single detail field
 */
function DetailFieldItem({
  fieldConfig,
  entity,
  t,
}: {
  fieldConfig: FieldConfig | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: Record<string, any>
  t: (key: string) => string
}) {
  const { isGranted } = usePermissionContext()
  const field: FieldConfig = typeof fieldConfig === "string" ? { name: fieldConfig } : fieldConfig

  // Hide permission-gated fields for users lacking the key (admins bypass via isGranted).
  if (field.requiredPermission && !isGranted(field.requiredPermission)) return null
  if (field.condition && !field.condition(entity)) return null

  const value = getNestedValue(entity, field.name)
  if ((value === null || value === undefined) && !field.render) return null

  return (
    <div className="animate-in fade-in duration-300">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
        {field.labelKey ? t(field.labelKey) : field.label || t(`pages.${field.name}`)}
      </label>

      {/* Simple Field Value Container */}
      <div className="px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 hover:border-border/50 transition-all duration-200">
        <div className="text-sm font-medium text-foreground">
          {field.render ? (
            field.render(value, entity)
          ) : (
            <FieldRenderer
              value={value as FieldValue}
              type={field.type || autoDetectFieldType(field.name, value)}
              entity={entity}
              config={field.config}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function autoDetectFieldType(fieldName: string, value: unknown): FieldRendererType {
  if (fieldName === "code") return "badge-code"
  if (fieldName === "name") return "text-primary"
  if (fieldName === "foreignName") return "text-arabic"
  if (fieldName.includes("Time") || fieldName.includes("Date")) {
    return fieldName.toLowerCase().includes("time") ? "datetime" : "date"
  }
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") {
    if (fieldName.includes("price") || fieldName.includes("amount") || fieldName.includes("cost")) return "currency"
    return "number"
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return "relation"
  return "text-primary"
}

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>
}

export function createMetadataSection(): DetailSection {
  return {
    title: "metadata",
    icon: <Clock className="h-4 w-4 text-primary" />,
    fields: [
      { name: "creationTime", type: "datetime", labelKey: "pages.created" },
      {
        name: "lastModificationTime",
        type: "datetime",
        labelKey: "pages.last_modified",
        condition: entity => !!entity.lastModificationTime,
      },
    ],
  }
}

export function createPrimaryInfoSection(additionalFields: (FieldConfig | string)[] = []): DetailSection {
  return {
    title: "primary_information",
    fields: [
      { name: "code", type: "badge-code" },
      { name: "name", type: "text-primary" },
      { name: "foreignName", type: "text-arabic", condition: entity => !!entity.foreignName },
      ...additionalFields,
      { name: "note", type: "text-secondary", condition: entity => !!entity.note },
    ],
  }
}
