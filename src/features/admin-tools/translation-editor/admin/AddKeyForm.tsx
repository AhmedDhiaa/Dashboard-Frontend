"use client"

/**
 * "Add key" — the parity-safe way to CREATE a new translation key from the UI.
 *
 * Creating a key in only one locale breaks the en/ar parity CI gate, so this
 * form requires BOTH locale values up front and writes them atomically via
 * `patchSourceBoth` (→ /api/i18n/source-write with a { values } body). It is
 * only meaningful when source-write mode is armed (it edits the real message
 * files), so the trigger is hidden otherwise.
 */

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { useNotification } from "@/ui/application"
import { HttpError, patchSourceBoth } from "../api"
import { SOURCE_WRITE_ENABLED } from "../lib/write-mode"

interface AddKeyFormProps {
  onAdded: () => void
}

export function AddKeyForm({ onAdded }: AddKeyFormProps): React.ReactNode {
  const notifications = useNotification()
  const [open, setOpen] = useState(false)
  const [namespace, setNamespace] = useState("")
  const [keyPath, setKeyPath] = useState("")
  const [en, setEn] = useState("")
  const [ar, setAr] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Source-write only — overrides can't introduce brand-new keys.
  if (!SOURCE_WRITE_ENABLED) return null

  const reset = () => {
    setNamespace("")
    setKeyPath("")
    setEn("")
    setAr("")
    setError(null)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const canSubmit =
    namespace.trim() !== "" && keyPath.trim() !== "" && en.trim() !== "" && ar.trim() !== "" && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await patchSourceBoth(namespace.trim(), keyPath.trim(), { en: en.trim(), ar: ar.trim() })
      notifications.success("crud.messages.success_save")
      onAdded()
      close()
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : err instanceof Error ? err.message : "Failed to add key"
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Plus className="h-4 w-4" />
        Add key
      </Button>

      {open && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-semibold">Add translation key</h2>
                <p className="text-xs text-muted-foreground">Both locales are required to keep en/ar in parity.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={close} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="p-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Namespace</span>
                <Input value={namespace} onChange={e => setNamespace(e.target.value)} placeholder="common" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Key path (dotted)</span>
                <Input value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="actions.newButton" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">English (en)</span>
                <Input value={en} onChange={e => setEn(e.target.value)} placeholder="New" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Arabic (ar)</span>
                <Input value={ar} onChange={e => setAr(e.target.value)} placeholder="جديد" dir="rtl" />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <footer className="p-4 border-t border-border flex gap-2 justify-end">
              <Button variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!canSubmit}>
                {busy ? "Saving…" : "Save key"}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
