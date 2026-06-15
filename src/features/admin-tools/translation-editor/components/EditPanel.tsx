"use client"

/**
 * The slide-in side panel. Sub-components handle the visual chrome so the
 * top-level component stays readable and within the per-function line cap.
 */

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useTranslationEditor } from "../TranslationEditorContext"
import { WriteModeBadge } from "./WriteModeBadge"
import type { KeyDescriptor } from "../types"

interface PanelHeaderProps {
  descriptor: KeyDescriptor
  onClose: () => void
}

function PanelHeader({ descriptor, onClose }: PanelHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{descriptor.namespace || "(no namespace)"}</p>
          <WriteModeBadge size="sm" />
        </div>
        <h2 className="font-semibold truncate">{descriptor.keyPath}</h2>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
        <X className="h-4 w-4" />
      </Button>
    </header>
  )
}

interface ReadOnlyBlockProps {
  label: string
  value: string
  emphasised?: boolean
}

function ReadOnlyBlock({ label, value, emphasised }: ReadOnlyBlockProps) {
  return (
    <section>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <pre
        className={`mt-1 p-3 rounded-md text-sm whitespace-pre-wrap break-words font-mono ${
          emphasised ? "bg-primary/5 border border-primary/20" : "bg-muted/40"
        }`}
      >
        {value}
      </pre>
    </section>
  )
}

interface PanelFooterProps {
  busy: boolean
  hasOverride: boolean
  dirty: boolean
  onSave: () => void
  onQueue: () => void
  onRevert: () => void
}

function PanelFooter({ busy, hasOverride, dirty, onSave, onQueue, onRevert }: PanelFooterProps) {
  return (
    <footer className="border-t border-border p-4 flex flex-col gap-2">
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={busy || !dirty} className="flex-1">
          Save now
        </Button>
        <Button variant="outline" onClick={onQueue} disabled={busy} className="flex-1">
          Queue for batch
        </Button>
      </div>
      <Button variant="ghost" onClick={onRevert} disabled={busy || !hasOverride} className="text-destructive">
        Revert override
      </Button>
    </footer>
  )
}

export function EditPanel(): React.ReactNode {
  const { activeKey, closePanel, callIndex, overrides, saveEdit, revertOverride, setPending, pending } =
    useTranslationEditor()
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeKey) return
    const existingOverride = overrides[activeKey.flatKey]
    const existingPending = pending.get(activeKey.flatKey)?.draft
    const rendered = callIndex.get(activeKey.flatKey)?.rendered ?? ""
    setDraft(existingPending ?? existingOverride ?? rendered)
    setError(null)
  }, [activeKey, overrides, pending, callIndex])

  if (!activeKey) return null

  const rendered = callIndex.get(activeKey.flatKey)?.rendered ?? ""
  const currentOverride = overrides[activeKey.flatKey]
  const hasOverride = currentOverride !== undefined
  const baseline = currentOverride ?? rendered

  const wrap = (action: () => Promise<unknown>, fallback: string) => async () => {
    setBusy(true)
    setError(null)
    try {
      await action()
      closePanel()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-translation-editor-ui="1"
      className="fixed top-0 end-0 h-full w-full max-w-md bg-card border-s border-border shadow-sm z-[9998] flex flex-col"
    >
      <PanelHeader descriptor={activeKey} onClose={closePanel} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ReadOnlyBlock label="Original (file value)" value={rendered || "(unrendered)"} />
        {hasOverride && <ReadOnlyBlock label="Active override" value={currentOverride} emphasised />}
        <section>
          <label htmlFor="translation-draft" className="text-xs font-medium text-muted-foreground">
            New value
          </label>
          <textarea
            id="translation-draft"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={busy}
            rows={6}
            className="mt-1 w-full p-3 border border-border rounded-md bg-background text-sm font-mono"
          />
        </section>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <PanelFooter
        busy={busy}
        hasOverride={hasOverride}
        dirty={draft !== baseline}
        onSave={wrap(() => saveEdit(activeKey, draft), "Save failed")}
        onQueue={() => {
          setPending(activeKey, draft, baseline)
          closePanel()
        }}
        onRevert={wrap(() => revertOverride(activeKey), "Revert failed")}
      />
    </div>
  )
}
