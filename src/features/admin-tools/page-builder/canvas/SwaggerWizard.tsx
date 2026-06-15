"use client"

/**
 * Swagger wizard — the "Create from API" entry point on the canvas.
 *
 * Flow (per spec §5):
 *   1. Admin enters a Swagger URL.
 *   2. Wizard hits `/api/admin/page-builder/proxy-swagger` (server-side fetch
 *      + cache → cross-origin issues stay off the client) which returns
 *      `{ info, clusters }`.
 *   3. Each cluster shows as a row in a tree-style picker. Picking one
 *      generates a draft `PageSchema` via `generatePageFromCluster` and
 *      hands it to the canvas via `onAccept`.
 *
 * Errors during the proxy fetch surface inline — no silent failure.
 */

import { useCallback, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/design-system/primitives/dialog"
import { Loader2, Sparkles, AlertTriangle } from "lucide-react"
import { generatePageFromCluster } from "../openapi/page-generator"
import type { ParsedSchema, ResourceCluster } from "../openapi/parser"
import type { PageSchema } from "../schema/page-schema"

interface ProxyResponse {
  info?: { title?: string; version?: string }
  clusters: ResourceCluster[]
  schemas?: Record<string, ParsedSchema>
  cached?: boolean
  error?: string
}

export interface SwaggerWizardProps {
  open: boolean
  onClose: () => void
  onAccept: (schema: PageSchema) => void
  /** Default URL — usually `${NEXT_PUBLIC_API_URL}/swagger/v1/swagger.json`. */
  defaultUrl?: string
}

export function SwaggerWizard({ open, onClose, onAccept, defaultUrl = "" }: SwaggerWizardProps) {
  const [url, setUrl] = useState(defaultUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<ProxyResponse["info"]>(undefined)
  const [clusters, setClusters] = useState<ResourceCluster[]>([])
  const [schemas, setSchemas] = useState<Record<string, ParsedSchema>>({})

  const handleFetch = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/page-builder/proxy-swagger?url=${encodeURIComponent(url)}`, {
        credentials: "include",
      })
      const data = (await response.json()) as ProxyResponse
      if (!response.ok || data.error) {
        setError(data.error ?? `Proxy returned ${response.status}`)
        return
      }
      setInfo(data.info)
      setClusters(data.clusters)
      setSchemas(data.schemas ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setBusy(false)
    }
  }, [url])

  const handlePick = useCallback(
    (cluster: ResourceCluster) => {
      const generated = generatePageFromCluster(cluster, { schemas })
      onAccept(generated.schema)
      onClose()
    },
    [onAccept, onClose, schemas],
  )

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create from API</DialogTitle>
        </DialogHeader>

        <div className="space-y-3" data-testid="swagger-wizard">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.example.com/swagger/v1/swagger.json"
              data-testid="swagger-url-input"
            />
            <Button onClick={handleFetch} disabled={busy || !url} data-testid="swagger-fetch-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
            </Button>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="swagger-error"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <p className="text-xs text-muted-foreground" data-testid="swagger-info">
              {info.title} {info.version ? `v${info.version}` : ""} — <strong>{clusters.length}</strong> resource
              cluster{clusters.length === 1 ? "" : "s"} discovered.
            </p>
          )}

          {clusters.length > 0 && <ClusterTree clusters={clusters} onPick={handlePick} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="swagger-close">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ClusterTreeProps {
  clusters: ResourceCluster[]
  onPick: (cluster: ResourceCluster) => void
}

function ClusterTree({ clusters, onPick }: ClusterTreeProps) {
  return (
    <ul className="max-h-96 space-y-1 overflow-y-auto rounded border border-border" data-testid="swagger-cluster-list">
      {clusters.map(cluster => {
        const verbs: string[] = []
        if (cluster.list) verbs.push("LIST")
        if (cluster.create) verbs.push("CREATE")
        if (cluster.detail) verbs.push("DETAIL")
        if (cluster.update) verbs.push("UPDATE")
        if (cluster.delete) verbs.push("DELETE")
        const customCount = cluster.customActions.length
        return (
          <li key={cluster.basePath}>
            <button
              type="button"
              onClick={() => onPick(cluster)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-accent"
              data-testid={`swagger-cluster-${cluster.name}`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">{cluster.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{cluster.basePath}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {verbs.map(v => (
                  <span key={v} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                    {v}
                  </span>
                ))}
                {customCount > 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    +{customCount}
                  </span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
