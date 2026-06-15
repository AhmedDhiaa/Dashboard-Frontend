"use client"

/**
 * Wizard step 5 — final validation + persist. POSTs the schema at
 * /api/admin/widget-builder/generate which validates server-side, writes
 * the widget definition, and (in runtime mode) emits the .widget.ts file.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import { widgetBuilderSchema } from "../types/widget-schema"
import type { WidgetDraft } from "./useWidgetWizardState"
import { API_ROUTES } from "@/shared/api/routes"

interface Props {
  draft: WidgetDraft
  mode: "create" | "update"
  onBack: () => void
}

export function Step5Save({ draft, mode, onBack }: Props): React.ReactNode {
  const router = useRouter()
  const parsed = useMemo(() => widgetBuilderSchema.safeParse(draft), [draft])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ success: true; message: string } | { success: false; error: string } | null>(
    null,
  )

  if (!parsed.success) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Schema invalid:</p>
        <ul className="text-xs text-destructive list-disc list-inside">
          {parsed.error.issues.map((iss, i) => (
            <li key={i}>
              {iss.path.join(".") || "<root>"}: {iss.message}
            </li>
          ))}
        </ul>
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch(API_ROUTES.widgetBuilder.generate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, schema: parsed.data }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string; message?: string }
      if (!res.ok || !json.success) {
        setResult({ success: false, error: json.error ?? `Save failed (${res.status})` })
      } else {
        setResult({ success: true, message: json.message ?? "Saved." })
        if (typeof window !== "undefined") sessionStorage.removeItem("acme:widget-builder:draft")
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Network error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-md border border-border bg-card p-4 space-y-2 text-sm">
        <Row label="ID" value={parsed.data.id} />
        <Row label="Title key" value={parsed.data.titleKey} />
        <Row label="Category" value={parsed.data.category} />
        <Row label="Visualization" value={parsed.data.visualization.type} />
        <Row
          label="Source"
          value={
            parsed.data.dataSource.type === "entity-list"
              ? `entity:${parsed.data.dataSource.entityName}`
              : `api:${parsed.data.dataSource.endpoint}`
          }
        />
        <Row label="Refresh" value={parsed.data.refresh.mode} />
        <Row label="Layout" value={`${parsed.data.layout.w} × ${parsed.data.layout.h}`} />
        <Row label="Permission" value={parsed.data.permissionKey} />
      </div>

      {result?.success === false && <p className="text-sm text-destructive">{result.error}</p>}
      {result?.success === true && (
        <div className="text-sm text-success space-y-2">
          <p>{result.message}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/admin/widget-builder")}>
              Back to widgets
            </Button>
            <Button onClick={() => router.push("/dashboard")}>Open dashboard</Button>
          </div>
        </div>
      )}

      {!result?.success && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            ← Back
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : `Save widget`}
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <code className="font-mono text-xs">{value}</code>
    </div>
  )
}
