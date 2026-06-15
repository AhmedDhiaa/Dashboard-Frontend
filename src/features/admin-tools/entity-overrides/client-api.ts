/**
 * Client-side wrappers for the entity-override admin API.
 *
 * Projection (entity name → JSON-safe shape the editor needs) is built
 * here on the client by reading the registry directly. The configs are
 * already registered via `initializeEntityConfigs()` in ClientProviders;
 * we just have to force every lazy loader to fire so the registry is
 * fully populated before we read.
 *
 * Why client-side? Importing the configs from a server route handler
 * pulls every domain config into that route's RSC graph, and many
 * configs transitively use client-only React hooks (`useState`, etc.),
 * which webpack rejects. Doing the projection client-side keeps the
 * server contract narrow (just the override map JSON).
 */

import { API_ROUTES } from "@/shared/api/routes"
import { ensureEntityConfig, getEntityConfig, getKnownEntityNames } from "@/core/entities/registry"
import type { FormFieldConfig } from "@/core/entities/types"
import type { EntityOverride, EntityOverrideMap } from "@/core/entities/overrides/schema"

export interface FormFieldProjection {
  name: string
  type: FormFieldConfig["type"]
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hidden?: boolean
  rows?: number
  colSpan?: number
}

export interface EntityProjection {
  entityName: string
  singularName: string
  pluralName: string
  defaultPageSize?: number
  defaultSort?: { field: string; direction: "asc" | "desc" }
  features?: Record<string, boolean | undefined>
  permissionKey?: string
  basePath?: string
  formFieldOrder: string[]
  formFields: FormFieldProjection[]
  hasOverride: boolean
}

export interface RegistryResponse {
  entities: EntityProjection[]
  overrides: EntityOverrideMap
}

function projectFormField(name: string, field: FormFieldConfig): FormFieldProjection {
  return {
    name,
    type: field.type,
    ...(field.label !== undefined && { label: field.label }),
    ...(field.description !== undefined && { description: field.description }),
    ...(field.placeholder !== undefined && { placeholder: field.placeholder }),
    ...(field.required !== undefined && { required: field.required }),
    ...(field.disabled !== undefined && { disabled: field.disabled }),
    ...(field.hidden !== undefined && { hidden: field.hidden }),
    ...(field.rows !== undefined && { rows: field.rows }),
    ...(field.colSpan !== undefined && { colSpan: field.colSpan }),
  }
}

function projectEntity(entityName: string, overrides: EntityOverrideMap): EntityProjection {
  const config = getEntityConfig(entityName)
  const fieldOrder =
    config.formFieldOrder && config.formFieldOrder.length > 0
      ? config.formFieldOrder
      : Object.keys(config.formFields ?? {})
  const formFields: FormFieldProjection[] = fieldOrder
    .filter(name => config.formFields[name])
    .map(name => projectFormField(name, config.formFields[name]!))

  return {
    entityName,
    singularName: config.singularName,
    pluralName: config.pluralName,
    ...(config.defaultPageSize !== undefined && { defaultPageSize: config.defaultPageSize }),
    ...(config.defaultSort && {
      defaultSort: {
        field: String(config.defaultSort.field),
        direction: config.defaultSort.direction,
      },
    }),
    ...(config.features && { features: { ...config.features } }),
    ...(config.permissionKey !== undefined && { permissionKey: config.permissionKey }),
    ...(config.basePath !== undefined && { basePath: config.basePath }),
    formFieldOrder: fieldOrder,
    formFields,
    hasOverride: entityName in overrides,
  }
}

async function fetchOverrideMap(): Promise<EntityOverrideMap> {
  const res = await fetch(API_ROUTES.entityOverrides.base, { cache: "no-store" })
  if (!res.ok) throw new Error(`Override map fetch failed (${res.status})`)
  const data = (await res.json()) as { overrides: EntityOverrideMap }
  return data.overrides ?? {}
}

export async function fetchEntityRegistry(): Promise<RegistryResponse> {
  const overrides = await fetchOverrideMap()
  const names = getKnownEntityNames()
  // Force every lazy loader so `getEntityConfig` succeeds for each name.
  // Failures are swallowed here — a single broken config shouldn't take
  // the whole panel offline; the entity drops out of the list and the
  // admin still sees the rest.
  const settled = await Promise.allSettled(names.map(name => ensureEntityConfig(name)))
  const ready = names.filter((_, i) => settled[i]?.status === "fulfilled")
  const entities = ready
    .map(name => {
      try {
        return projectEntity(name, overrides)
      } catch {
        return null
      }
    })
    .filter((e): e is EntityProjection => e !== null)
  return { entities, overrides }
}

export async function fetchEntityOverride(entityName: string): Promise<EntityOverride | null> {
  const res = await fetch(API_ROUTES.entityOverrides.item(entityName), { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Fetch override failed (${res.status})`)
  const data = (await res.json()) as { override: EntityOverride }
  return data.override
}

export async function saveEntityOverride(entityName: string, override: EntityOverride): Promise<EntityOverrideMap> {
  const res = await fetch(API_ROUTES.entityOverrides.base, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityName, override }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Save failed (${res.status}): ${text}`)
  }
  const data = (await res.json()) as { overrides: EntityOverrideMap }
  return data.overrides
}

export async function resetEntityOverride(entityName: string): Promise<EntityOverrideMap> {
  const res = await fetch(API_ROUTES.entityOverrides.item(entityName), { method: "DELETE" })
  if (res.status === 404) return {}
  if (!res.ok) throw new Error(`Reset failed (${res.status})`)
  const data = (await res.json()) as { overrides: EntityOverrideMap }
  return data.overrides
}
