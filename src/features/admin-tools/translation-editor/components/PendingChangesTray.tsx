"use client"

/**
 * Bottom-right tray listing every queued (but not yet published) edit.
 * Hidden when the pending map is empty so it doesn't clutter the screen
 * once everything is published.
 */

import { useState } from "react"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useTranslationEditor } from "../TranslationEditorContext"

export function PendingChangesTray(): React.ReactNode {
  const { pending, discardPending, publishAll, edit } = useTranslationEditor()
  const [expanded, setExpanded] = useState(true)
  const [busy, setBusy] = useState(false)

  if (pending.size === 0) return null

  const handlePublish = async () => {
    setBusy(true)
    try {
      await publishAll()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-translation-editor-ui="1"
      className="fixed bottom-4 end-4 w-80 bg-card border border-border shadow-xl rounded-lg z-[9997] flex flex-col"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between p-3 border-b border-border w-full text-start"
      >
        <span className="font-semibold text-sm">Pending changes ({pending.size})</span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {expanded && (
        <>
          <ul className="max-h-64 overflow-y-auto divide-y divide-border">
            {Array.from(pending.values()).map(item => (
              <li key={item.flatKey} className="p-3 flex items-start justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => edit({ namespace: item.namespace, keyPath: item.keyPath, flatKey: item.flatKey })}
                  className="flex-1 min-w-0 text-start hover:text-primary"
                >
                  <p className="font-medium truncate">{item.flatKey}</p>
                  <p className="text-muted-foreground truncate font-mono">{item.draft}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => discardPending(item.flatKey)}
                  disabled={busy}
                  className="h-6 w-6 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-border">
            <Button onClick={handlePublish} disabled={busy} className="w-full">
              {busy ? "Publishing..." : `Publish all (${pending.size})`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
