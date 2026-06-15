"use client"

/**
 * MaterializeDialog — preview + commit the runtime → source-file promotion.
 *
 * Layout (top to bottom):
 *
 *   - DialogHeader: title + description (unchanged from prior version)
 *   - MaterializeSummaryCard: 4 controls (sidebar group / position / icon /
 *     permission key) that flow into the materialize POST body
 *   - MaterializeFileList: two-section grouped file list (entity files +
 *     registry updates), replacing the prior flat <DiffFile> list
 *   - Action row: DryRun preview button (count summary toast — full diff
 *     modal is Part 3.4) + Cancel + Materialize
 *
 * Dialog state machine unchanged: loading → preview → writing → success
 * | error. The summary card's `value` is React-state inside the
 * component (seeded from `entity.navigation` or computeDefaults). Saving
 * it back onto the runtime entity is deferred — Part 3.2 only wires the
 * controls into the POST body; persistent storage is the next iteration.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Rocket, Eye } from "lucide-react"
import type { RuntimeEntity } from "../types"
import { Button } from "@/ui/design-system/primitives/button"
import { API_ROUTES } from "@/shared/api/routes"
import { useNotification } from "@/ui/application"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/design-system/primitives/dialog"
import { NAV_GROUP_KEYS } from "@/shared/config/navigation"
import { MaterializeSummaryCard, computeDefaults, type MaterializeSummaryValue } from "./MaterializeSummaryCard"
import { MaterializeFileList, classifyMaterializeFile, type MaterializeFile } from "./MaterializeFileList"

interface PreviewResponse {
  mode: "preview"
  plan: { entityName: string; files: { path: string }[] }
  // Old shape was diff[], new shape from Part 3.1 adds registryDiffs.
  diff?: unknown
  registryDiffs?: { path: string; diff: string }[]
}

interface SuccessResponse {
  success: true
  mode: "materialize"
  route: string
  files: string[]
  warnings: string[]
  backupId: string | null
}

type Phase = "loading" | "preview" | "writing" | "success" | "error"

export interface MaterializeDialogProps {
  entity: RuntimeEntity
  open: boolean
  onOpenChange: (open: boolean) => void
  onMaterialized?: (route: string) => void
}

function pluralize(name: string): string {
  // Mirrors the server's `pluralizeEnglish` for the default href display.
  return /(s|x|z|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`
}

function seedSummary(entity: RuntimeEntity): MaterializeSummaryValue {
  const defaults = computeDefaults(entity.id, NAV_GROUP_KEYS)
  return {
    group: entity.navigation?.group ?? defaults.group,
    order: entity.navigation?.order ?? defaults.order,
    icon: entity.navigation?.icon ?? defaults.icon,
    permissionKey: entity.permissionKey ?? defaults.permissionKey,
  }
}

function buildMaterializeBody(summary: MaterializeSummaryValue, entityNameKebab: string) {
  const plural = pluralize(entityNameKebab)
  // The route's body parser (Part 3.1) accepts navigation + permissionKey
  // alongside the existing { force, domain } fields. We always send the
  // navigation block; permissionKey is only included when the input has
  // 3+ ABP segments (the patcher refuses 2-segment values).
  const navigation = {
    group: summary.group,
    titleKey: `pages.${entityNameKebab}.title`,
    href: `/${plural}`,
    icon: summary.icon,
    order: summary.order,
    requiredPermission: summary.permissionKey,
  }
  const segments = summary.permissionKey.split(".")
  const permissionKey =
    segments.length >= 3
      ? {
          identifier: summary.permissionKey
            .slice("Api.".length)
            .replace(/\./g, "_")
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .toUpperCase(),
          value: summary.permissionKey,
        }
      : undefined
  return { navigation, permissionKey }
}

// State + handlers extracted into a hook so MaterializeDialog stays under
// the max-lines-per-function gate. All mutation funnels through here; the
// component itself is just the dialog scaffolding + phase routing.
function useMaterializeController(entity: RuntimeEntity, onMaterialized?: (route: string) => void) {
  const notifications = useNotification()
  const [phase, setPhase] = useState<Phase>("preview")
  const [summary, setSummary] = useState<MaterializeSummaryValue>(() => seedSummary(entity))
  const [files, setFiles] = useState<MaterializeFile[]>([])
  const [success, setSuccess] = useState<SuccessResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = (open: boolean) => {
    if (!open) return
    setSummary(seedSummary(entity))
    setFiles([])
    setSuccess(null)
    setError(null)
    setPhase("preview")
  }

  const runDryRun = async () => {
    setPhase("loading")
    setError(null)
    try {
      const body = buildMaterializeBody(summary, entity.id)
      const res = await fetch(`${API_ROUTES.runtime.materialize(encodeURIComponent(entity.id))}?dryRun=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string }
      if (!res.ok) {
        setError(json.error ?? `Preview failed (HTTP ${res.status})`)
        setPhase("error")
        return
      }
      const merged = mergePlannedFiles(json)
      setFiles(merged)
      const entityCount = merged.filter(f => f.kind === "entity").length
      const registryCount = merged.filter(f => f.kind === "registry").length
      notifications.info(`Will write ${entityCount} entity file(s) + ${registryCount} registry entry/entries`)
      setPhase("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview request failed")
      setPhase("error")
    }
  }

  const runMaterialize = async () => {
    setPhase("writing")
    setError(null)
    try {
      const body = buildMaterializeBody(summary, entity.id)
      const res = await fetch(API_ROUTES.runtime.materialize(encodeURIComponent(entity.id)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as SuccessResponse & { error?: string }
      if (!res.ok) {
        setError(json.error ?? `Materialize failed (HTTP ${res.status})`)
        setPhase("error")
        return
      }
      setSuccess(json)
      setPhase("success")
      onMaterialized?.(json.route)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Materialize request failed")
      setPhase("error")
    }
  }

  return { phase, summary, setSummary, files, success, error, reset, runDryRun, runMaterialize }
}

function mergePlannedFiles(json: PreviewResponse): MaterializeFile[] {
  const entityFiles = (json.plan?.files ?? []).map(f => ({
    path: f.path,
    kind: classifyMaterializeFile(f.path),
  }))
  const registryFiles: MaterializeFile[] = (json.registryDiffs ?? []).map(d => ({
    path: d.path,
    kind: "registry" as const,
  }))
  // Dedup on path — a registry path can in theory show up in both lists.
  const merged = new Map<string, MaterializeFile>()
  for (const f of [...entityFiles, ...registryFiles]) merged.set(f.path, f)
  return [...merged.values()]
}

export function MaterializeDialog({ entity, open, onOpenChange, onMaterialized }: MaterializeDialogProps) {
  const c = useMaterializeController(entity, onMaterialized)
  const router = useRouter()
  const notifications = useNotification()

  useEffect(() => {
    c.reset(open)
    // We deliberately exclude `c` itself from deps — only the open/entity
    // signal should retrigger the reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity])

  // Fire the unified source-write toast on entry into the success phase.
  // The persistent SuccessBody panel keeps showing the file list +
  // backup id; the toast is the transient "you wrote files, go review
  // them" cue that survives across navigation.
  useEffect(() => {
    if (c.phase !== "success" || !c.success) return
    notifySourceWrite(notifications, c.success.files.length, router)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per phase transition
  }, [c.phase])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Materialize {entity.pluralName} to source files
          </DialogTitle>
          <DialogDescription>
            Generate <code className="font-mono">.config.tsx</code> + sibling source under{" "}
            <code className="font-mono">src/domains/</code>, then auto-register the new entry in
            <code className="font-mono"> permission-keys.ts</code> + <code className="font-mono">navigation.ts</code>.
          </DialogDescription>
        </DialogHeader>

        {(c.phase === "preview" || c.phase === "loading") && (
          <PreviewBody
            entity={entity}
            summary={c.summary}
            onSummaryChange={c.setSummary}
            files={c.files}
            loading={c.phase === "loading"}
            onDryRun={c.runDryRun}
            onCancel={() => onOpenChange(false)}
            onConfirm={c.runMaterialize}
          />
        )}

        {c.phase === "writing" && <LoadingState label="Writing files + patching registries…" />}

        {c.phase === "success" && c.success && <SuccessBody success={c.success} onClose={() => onOpenChange(false)} />}

        {c.phase === "error" && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {c.error}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

interface PreviewBodyProps {
  entity: RuntimeEntity
  summary: MaterializeSummaryValue
  onSummaryChange: (next: MaterializeSummaryValue) => void
  files: readonly MaterializeFile[]
  loading: boolean
  onDryRun: () => void
  onCancel: () => void
  onConfirm: () => void
}

function PreviewBody({
  entity,
  summary,
  onSummaryChange,
  files,
  loading,
  onDryRun,
  onCancel,
  onConfirm,
}: PreviewBodyProps): React.ReactNode {
  return (
    <div className="space-y-4">
      <MaterializeSummaryCard
        value={summary}
        onChange={onSummaryChange}
        entityNamePlural={pluralize(entity.id)}
        entityNameKebab={entity.id}
        navGroupOptions={NAV_GROUP_KEYS}
      />

      {files.length > 0 ? (
        <MaterializeFileList files={files} />
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
          Click <strong>DryRun preview</strong> to see which files this materialize will touch.
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onDryRun} disabled={loading} className="gap-2 me-auto">
          <Eye className="h-4 w-4" />
          {loading ? "Computing…" : "DryRun preview"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={loading} className="gap-2">
          <Rocket className="h-4 w-4" />
          Materialize to disk
        </Button>
      </div>
    </div>
  )
}

function SuccessBody({ success, onClose }: { success: SuccessResponse; onClose: () => void }) {
  // Surface the same two-section file grouping on success — the admin
  // sees confirmation that BOTH the entity AND registry writes landed.
  const files = success.files.map(p => ({ path: p, kind: classifyMaterializeFile(p) }))
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-success bg-success/10 p-3 text-sm">
        <p className="font-medium text-success">Wrote {success.files.length} file(s).</p>
        {success.backupId && (
          <p className="text-xs text-muted-foreground mt-1">
            Snapshot: <code className="font-mono">{success.backupId}</code>
          </p>
        )}
      </div>

      {success.warnings.length > 0 && (
        <div className="rounded-md border border-warning bg-warning/10 p-3 text-xs space-y-1">
          <p className="font-medium text-warning">{success.warnings.length} warning(s):</p>
          <ul className="list-disc list-inside text-muted-foreground">
            {success.warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <MaterializeFileList files={files} />

      <div className="flex items-center justify-between pt-2 border-t">
        <a href={success.route} className="text-sm inline-flex items-center gap-1 text-primary hover:underline">
          Open <code className="font-mono">{success.route}</code>
          <ArrowRight className="h-4 w-4" />
        </a>
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
