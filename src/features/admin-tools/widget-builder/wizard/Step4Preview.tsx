"use client"

/**
 * Wizard step 4 — preview the widget against either deterministic mock
 * data (default; fast) or live data fetched from the configured source.
 *
 * Live mode just calls the source's endpoint with same-origin credentials;
 * if it 401s, the admin sees the error in the renderer and can fall back
 * to mock mode without leaving the wizard.
 */

import { useEffect, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { widgetBuilderSchema, type WidgetBuilderSchema } from "../types/widget-schema"
import { mockDataForWidget } from "@/shared/widgets/mock-data"
import { WidgetRenderer } from "@/shared/widgets/WidgetRenderer"
import type { WidgetDraft } from "./useWidgetWizardState"
import { API_ROUTES } from "@/shared/api/routes"

interface Props {
  draft: WidgetDraft
  onBack: () => void
  onComplete: () => void
}

export function Step4Preview({ draft, onBack, onComplete }: Props): React.ReactNode {
  const parsed = widgetBuilderSchema.safeParse(draft)
  const [mode, setMode] = useState<"mock" | "live">("mock")
  const [data, setData] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!parsed.success) return
    if (mode === "mock") {
      setData(mockDataForWidget(parsed.data))
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchLive(parsed.data)
        if (!cancelled) setData(rows)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Fetch failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [mode, parsed.success, parsed.data])

  if (!parsed.success) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Cannot preview — schema invalid.</p>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ModeButton active={mode === "mock"} onClick={() => setMode("mock")}>
          Mock data
        </ModeButton>
        <ModeButton active={mode === "live"} onClick={() => setMode("live")}>
          Live data
        </ModeButton>
      </div>
      <div className="border border-dashed border-border rounded-md p-4 bg-muted/30">
        <div
          className="mx-auto"
          style={{ width: `${(parsed.data.layout.w / 12) * 100}%`, height: parsed.data.layout.h * 80 }}
        >
          <WidgetRenderer schema={parsed.data} data={data} loading={loading} error={error} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {parsed.data.layout.w}/12 cols × {parsed.data.layout.h} rows
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onComplete}>Continue → Save</Button>
      </div>
    </div>
  )
}

async function fetchLive(schema: WidgetBuilderSchema): Promise<Record<string, unknown>[]> {
  if (schema.dataSource.type === "api-call") {
    const init: RequestInit = { credentials: "same-origin", method: schema.dataSource.method }
    if (schema.dataSource.method === "POST" && schema.dataSource.body) {
      init.headers = { "Content-Type": "application/json" }
      init.body = JSON.stringify(schema.dataSource.body)
    }
    const res = await fetch(schema.dataSource.endpoint, init)
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
    const payload = (await res.json()) as Record<string, unknown>
    return resolveItemsPath(payload, schema.dataSource.itemsPath)
  }
  // entity-list source — hit a generic preview endpoint that the registry
  // exposes. The endpoint is admin-only and returns a sample of the entity.
  const url = `${API_ROUTES.widgetBuilder.preview}?entity=${encodeURIComponent(schema.dataSource.entityName)}`
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`Preview failed (${res.status})`)
  const payload = (await res.json()) as { items: Record<string, unknown>[] }
  return payload.items
}

function resolveItemsPath(payload: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const segments = path.split(".").filter(Boolean)
  let cursor: unknown = payload
  for (const seg of segments) {
    if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[seg]
    } else {
      return []
    }
  }
  return Array.isArray(cursor) ? (cursor as Record<string, unknown>[]) : []
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
    >
      {children}
    </button>
  )
}
