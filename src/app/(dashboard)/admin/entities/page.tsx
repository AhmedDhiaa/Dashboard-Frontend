/**
 * /admin/entities — unified entity-management surface (Server Component).
 *
 * On first paint the full table HTML ships in the initial response: zero
 * XHR, zero hydrated tree below the page level except the <EditFieldsButton>
 * client leaves and the BackupsPanel below the table. Verifiable in
 * DevTools Network — clear the tab, navigate to /admin/entities, no
 * `/api/...` requests should fire before user interaction.
 *
 * Three data sources are read in parallel via `Promise.all`; each
 * underlying fetcher is wrapped in `React.cache` so concurrent
 * sub-components on the same render share a single read.
 *
 * Streaming layout:
 *
 *   <Header />                     ← always renders first
 *   <Suspense fallback=skeleton>
 *     <EntityTableSection />       ← streams in when data resolves
 *   </Suspense>
 *   <Suspense fallback=skeleton>
 *     <BackupsPanel />             ← independent stream; client-fetched
 *   </Suspense>
 *
 * Gates: NODE_ENV=production OR missing APP_ALLOW_RUNTIME_CODEGEN
 * → notFound(). Non-admin → redirect("/403"). These run BEFORE any data
 * is read so they short-circuit cheaply.
 */

import { cache, Suspense } from "react"
import path from "node:path"
import { redirect } from "next/navigation"
import { Database } from "lucide-react"
import { auth } from "@/infra/auth/server"
import { readConfig } from "@/app/api/runtime/_lib/storage"
import {
  buildConvertibilityReport,
  type ConvertibilityRow,
  type ParseResult,
} from "@/features/admin-tools/entity-converter/server/parse-static-config"
import { EntityTable, type EntityTableRow } from "@/features/admin-tools/entity-converter/dashboard/EntityTable"
import { BackupsPanel } from "@/features/admin-tools/entity-converter/dashboard/BackupsPanel"
import { SystemEntitiesPanel } from "@/features/admin-tools/entity-overrides/ui/SystemEntitiesPanel"
import { listSnapshots } from "@/features/admin-tools/entity-builder/server/backup"
import { findConvertBackupsByRuntimeId } from "@/features/admin-tools/entity-converter/server/convert-backups"
import { convertEntityAction, restoreConvertAction } from "./_actions"
import type { ExtendedSession } from "@/shared/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

// ─── Cached data fetchers ──────────────────────────────────────────────────
//
// `React.cache` memoizes the result per render — multiple suspended
// children that all need the runtime config share a single readConfig().
// The cache key is the function reference + arg shape, so each fetcher's
// arg-less form deduplicates on its own.

const getRuntimeEntities = cache(async (): Promise<Array<{ id: string; singularName?: string }>> => {
  const config = await readConfig()
  const entities = Array.isArray(config.entities)
    ? (config.entities as Array<{ id: string; singularName?: string }>)
    : []
  return entities
})

const getConvertibilityReport = cache(async (): Promise<ConvertibilityRow[]> => {
  return buildConvertibilityReport()
})

const getConvertBackups = cache(async (): Promise<Map<string, string>> => {
  // Map<runtimeEntityId, backupId> — drives the "Restore from source"
  // affordance on runtime rows. See convert-backups.ts for the
  // filtering contract (success-only, snapshot must still exist,
  // pruned by later restores).
  return findConvertBackupsByRuntimeId()
})

// ─── Auth gate ─────────────────────────────────────────────────────────────

async function requireAdminPage(): Promise<void> {
  const session = (await auth()) as ExtendedSession | null
  if (!session?.user) redirect("/auth/login")
  const roles = session.user.roles ?? []
  if (!roles.includes("admin")) redirect("/403")
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function AdminEntitiesPage(): Promise<React.ReactNode> {
  await requireAdminPage()

  // The override editor (SystemEntitiesPanel) is PROD-SAFE: it writes only to
  // the git-ignored override store and applies at read time — no codegen — so
  // it renders everywhere. The entity-converter + backups DELETE/RESTORE source
  // files and walk `src/domains` on disk, so they only work where codegen is
  // enabled (dev + flag); they stay hidden in production.
  const devTools = process.env.NODE_ENV !== "production" && process.env[RUNTIME_GATE] === "true"

  return (
    <div className="p-6 space-y-4 max-w-300">
      <Header />
      {devTools && (
        <>
          <Suspense fallback={<TableSkeleton />}>
            <EntityTableSection />
          </Suspense>
          <Suspense fallback={<BackupsSkeleton />}>
            <BackupsPanelSection />
          </Suspense>
        </>
      )}
      {/* In-UI override editor: edit any registered entity's config (labels,
          page size, field order, etc.) without touching source. Persists to
          the git-ignored runtime override store and applies at read time.
          Prod-safe (no codegen) — available in production too. */}
      <SystemEntitiesPanel />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Header(): React.ReactNode {
  return (
    <header className="flex items-center gap-3">
      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
        <Database className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Entity management</h1>
        <p className="text-xs text-muted-foreground">
          Unified view of static (source-file) and runtime (JSON-store) entities. Convert a convertible static entity to
          edit it from the UI.
        </p>
      </div>
    </header>
  )
}

async function EntityTableSection(): Promise<React.ReactNode> {
  const [runtimeEntities, report, convertBackups] = await Promise.all([
    getRuntimeEntities(),
    getConvertibilityReport(),
    getConvertBackups(),
  ])

  // Build the unified row set from two sources of truth:
  //   - runtime entities from `messages/_overrides/runtime/config.json`
  //   - static entities from the filesystem walk in
  //     `buildConvertibilityReport` (one row per `*.config.{ts,tsx}` under
  //     `src/domains/`).
  //
  // The static registry (`getRegisteredEntities()`) is intentionally NOT
  // consulted here. The registry's `registerLazyLoader` calls only populate
  // `ENTITY_CONFIGS` after a client-side `ensureEntityConfig(name)` resolves
  // — but this Server Component runs in a fresh server process where no
  // loader has fired. Reading the report directly gives us every entity
  // file on disk, which is the correct universe of "static" entities.
  const runtimeIds = new Set(runtimeEntities.map(e => e.id))

  const rows: EntityTableRow[] = []

  for (const e of runtimeEntities) {
    rows.push({
      id: e.id,
      displayName: e.singularName ?? e.id,
      source: "runtime",
      restoreBackupId: convertBackups.get(e.id),
    })
  }

  for (const reportRow of report) {
    // A name that's BOTH on disk AND runtime-present is the window
    // between convert + init-entities re-emit. Prefer the runtime row
    // in that case — the static one is about to disappear.
    if (runtimeIds.has(reportRow.entityName)) continue
    const parse = parseStaticConfigForRow(reportRow)
    rows.push({
      id: reportRow.entityName,
      displayName: friendlyName(reportRow.entityName),
      source: "static",
      parse,
      absoluteSourcePath: path.resolve(process.cwd(), reportRow.configPath),
    })
  }

  rows.sort((a, b) => a.id.localeCompare(b.id))
  return <EntityTable rows={rows} convertAction={convertEntityAction} restoreAction={restoreConvertAction} />
}

function parseStaticConfigForRow(reportRow: ConvertibilityRow): ParseResult {
  // The report only carries `ok + reason`. The table needs the full
  // ParseResult so the refusal tooltip + "Open in editor" path can be
  // rendered without re-running the walk for every row.
  if (reportRow.ok) {
    return { ok: true, entity: { id: reportRow.entityName } as never, sourcePaths: [], staticBlob: {} }
  }
  return { ok: false, reason: reportRow.reason ?? "Unknown refusal", filePath: reportRow.configPath }
}

function friendlyName(id: string): string {
  // "purchase-invoice" → "Purchase invoice". The static registry can't be
  // queried here — `registerLazyLoader` only populates ENTITY_CONFIGS
  // after a client-side `ensureEntityConfig` call resolves, and this is
  // a Server Component. The kebab-to-titlecase derivation is good enough
  // for the table label; the underlying id stays canonical.
  return id.replace(/-/g, " ").replace(/^\w/, c => c.toUpperCase())
}

async function BackupsPanelSection(): Promise<React.ReactNode> {
  // Pre-fetching server-side keeps the panel zero-XHR on first paint:
  // the list ships inert in initial HTML. The Restore button stays a
  // client island (user-initiated, fine to fetch on click).
  const snapshots = await listSnapshots()
  return <BackupsPanel initialSnapshots={snapshots} />
}

function TableSkeleton(): React.ReactNode {
  return (
    <div className="border border-border rounded-md p-6 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-muted/60 rounded" />
        <div className="h-3 bg-muted/60 rounded" />
        <div className="h-3 bg-muted/60 rounded w-3/4" />
      </div>
    </div>
  )
}

function BackupsSkeleton(): React.ReactNode {
  return (
    <div className="border border-border rounded-md p-4 animate-pulse">
      <div className="h-4 w-20 bg-muted rounded mb-3" />
      <div className="h-3 w-full bg-muted/60 rounded" />
    </div>
  )
}
