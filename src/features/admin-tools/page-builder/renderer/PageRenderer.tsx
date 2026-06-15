"use client"

/**
 * Top-level Page Builder renderer (per spec §3 + §10).
 *
 * Composition:
 *   1. `PagePermissionGuardByKey` — page-level access control. Hidden if
 *      the current user lacks `pageSchema.permission`.
 *   2. Layout frame — `full` / `centered` / `two-column`.
 *   3. Title (from `pageSchema.title`) — Phase 3 always renders the EN copy;
 *      Phase 4 wires locale picking through `useLocale`.
 *   4. Sequential render of `pageSchema.blocks` via `BlockRenderer`.
 *
 * Per spec §10 a missing permission renders `null` (which the dynamic
 * route `/pages/[pageId]` translates to a 403 via `notFound()` /
 * permission redirect at the route-segment level).
 */

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import type { PageSchema } from "../schema/page-schema"
import { BlockRenderer } from "./BlockRenderer"

interface PagePermissionGuardByKeyProps {
  permission: string
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Spec §10 calls for `PagePermissionGuardByKey`. The existing
 * `PagePermissionGuard` (under `@/core/auth/guards/`) is entity-scoped
 * (`entityName + action`), which doesn't fit Page Builder's single
 * `permission` field. This guard is a thin wrapper around the existing
 * `usePermissionContext().isGranted(key)` — no new permission logic.
 */
export function PagePermissionGuardByKey({ permission, fallback = null, children }: PagePermissionGuardByKeyProps) {
  const { isGranted, isAdmin, isLoading } = usePermissionContext()

  if (isLoading) return null
  if (!isAdmin && !isGranted(permission)) return <>{fallback}</>
  return <>{children}</>
}

const LAYOUT_CLASSES: Record<PageSchema["layout"], string> = {
  full: "w-full",
  centered: "max-w-4xl mx-auto",
  "two-column": "grid grid-cols-1 lg:grid-cols-2 gap-6",
}

export interface PageRendererProps {
  schema: PageSchema
}

export function PageRenderer({ schema }: PageRendererProps) {
  return (
    <PagePermissionGuardByKey permission={schema.permission}>
      <div className={LAYOUT_CLASSES[schema.layout]} data-page-id={schema.id}>
        <PageHeader schema={schema} />
        <div className="space-y-6">
          {schema.blocks.map(block => (
            <BlockRenderer key={(block as { id: string }).id} block={block} />
          ))}
        </div>
      </div>
    </PagePermissionGuardByKey>
  )
}

/**
 * Renders the page title + optional description.
 *
 * Loads translations from the `pages_dynamic` namespace — every save
 * writes `pages_dynamic.<pageId>.title` etc. so admins can edit copy
 * via /admin/translations without redeploying. When the lookup returns
 * the raw key (next-intl's "missing translation" sentinel), we fall
 * back to the inline `.en` literal. That fallback path also fires in
 * unit tests where the namespace isn't loaded.
 */
function PageHeader({ schema }: { schema: PageSchema }) {
  const t = useTranslations("pages_dynamic")
  const titleKey = `${schema.id}.title`
  const titleFromI18n = resolveOrFallback(t, titleKey, schema.title.en)
  const descKey = `${schema.id}.description`
  const descFromI18n = schema.description ? resolveOrFallback(t, descKey, schema.description.en) : null
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{titleFromI18n}</h1>
      {descFromI18n && <p className="mt-1 text-sm text-muted-foreground">{descFromI18n}</p>}
    </header>
  )
}

function resolveOrFallback(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const value = t(key)
    // next-intl returns the key path when the message is missing; treat
    // that (and any value that contains the raw key string) as missing.
    if (typeof value !== "string" || value === key || value.includes(key)) return fallback
    return value
  } catch {
    return fallback
  }
}
