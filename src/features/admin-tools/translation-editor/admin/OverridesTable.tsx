"use client"

/**
 * Editable list of every override for the active locale.
 * - Search filters by flatKey or value (case-insensitive).
 * - Inline edit per row: pencil → textarea → Save (PATCH) / Cancel.
 * - Trash → DELETE.
 */

import { useMemo, useState } from "react"
import { Pencil, Save, Trash2, X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { deleteOverride, patchOverride } from "../api"
import { splitFlatKey } from "./import-schema"

interface OverridesTableProps {
  locale: "en" | "ar"
  overrides: Record<string, string>
  onChanged: () => void
  search: string
}

export function OverridesTable({ locale, overrides, onChanged, search }: OverridesTableProps): React.ReactNode {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return Object.entries(overrides)
      .filter(([k, v]) => !needle || k.toLowerCase().includes(needle) || v.toLowerCase().includes(needle))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [overrides, search])

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {Object.keys(overrides).length === 0 ? "No overrides yet for this locale." : "No matches."}
      </div>
    )
  }

  const startEdit = (flatKey: string, current: string) => {
    setEditingKey(flatKey)
    setDraft(current)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraft("")
  }

  const handleSave = async (flatKey: string) => {
    setBusy(true)
    try {
      const { namespace, keyPath } = splitFlatKey(flatKey)
      await patchOverride(locale, namespace, keyPath, draft)
      onChanged()
      cancelEdit()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (flatKey: string) => {
    setBusy(true)
    try {
      const { namespace, keyPath } = splitFlatKey(flatKey)
      await deleteOverride(locale, namespace, keyPath)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 sticky top-0">
        <tr>
          <th className="text-start p-2 font-medium w-1/3">Key</th>
          <th className="text-start p-2 font-medium">Value</th>
          <th className="text-end p-2 font-medium w-32">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([flatKey, value]) => (
          <OverrideRow
            key={flatKey}
            flatKey={flatKey}
            value={value}
            editing={editingKey === flatKey}
            draft={draft}
            busy={busy}
            onDraftChange={setDraft}
            onStartEdit={() => startEdit(flatKey, value)}
            onCancel={cancelEdit}
            onSave={() => handleSave(flatKey)}
            onDelete={() => handleDelete(flatKey)}
          />
        ))}
      </tbody>
    </table>
  )
}

interface OverrideRowProps {
  flatKey: string
  value: string
  editing: boolean
  draft: string
  busy: boolean
  onDraftChange: (v: string) => void
  onStartEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
}

function OverrideRow({
  flatKey,
  value,
  editing,
  draft,
  busy,
  onDraftChange,
  onStartEdit,
  onCancel,
  onSave,
  onDelete,
}: OverrideRowProps) {
  return (
    <tr className="border-t border-border align-top">
      <td className="p-2 font-mono text-xs">{flatKey}</td>
      <td className="p-2">
        {editing ? (
          <textarea
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            rows={3}
            className="w-full p-2 border border-border rounded bg-background text-sm font-mono"
            disabled={busy}
          />
        ) : (
          <span className="text-xs whitespace-pre-wrap break-words">{value}</span>
        )}
      </td>
      <td className="p-2">
        <div className="flex gap-1 justify-end">
          {editing ? (
            <>
              <Button size="icon" variant="ghost" onClick={onSave} disabled={busy}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onCancel} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" onClick={onStartEdit} disabled={busy}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} disabled={busy} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
