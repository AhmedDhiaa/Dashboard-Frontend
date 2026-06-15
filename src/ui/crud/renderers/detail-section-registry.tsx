/**
 * Detail Section Registry
 *
 * Provides standardized sections for DetailRenderer to eliminate boilerplate.
 */

import React from "react"
import { Shield, Clock, Info } from "lucide-react"

export interface FieldConfig {
  name: string
  type?: string
  label?: string
  labelKey?: string
  condition?: (entity: unknown) => boolean
  config?: unknown
  icon?: React.ElementType
}

export interface DetailSection {
  id: string
  titleKey: string
  icon: React.ElementType
  fields: (FieldConfig | string)[]
  condition?: (entity: unknown) => boolean
}

const REGISTRY: Record<string, DetailSection> = {
  PRIMARY: {
    id: "PRIMARY",
    titleKey: "pages.detail.primary_info",
    icon: Info,
    fields: ["code", "name", "foreignName"],
  },
  METADATA: {
    id: "METADATA",
    titleKey: "forms.sections.additional_info",
    icon: Shield,
    fields: [
      { name: "creationTime", type: "date", icon: Clock },
      { name: "lastModificationTime", type: "date", icon: Clock },
    ],
  },
}

/**
 * Get a registered section by ID
 */
export function getRegisteredSection(id: string): DetailSection {
  const section = REGISTRY[id]
  if (!section) {
    throw new Error(`[SectionRegistry] Section "${id}" not found.`)
  }
  return section
}
