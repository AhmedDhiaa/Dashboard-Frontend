"use client"

/**
 * "All translations" browser — view and edit the BASE translations (the
 * ~2882 keys that live in messages/<locale>/<namespace>.json), not just the
 * runtime overrides. Source-write only: it reads and writes the real message
 * files via /api/i18n/source-write, so it is mounted only when
 * SOURCE_WRITE_ENABLED (the admin page enforces that).
 *
 * Loads the full namespace JSON on mount / namespace change, flattens it to
 * { keyPath, value } rows, filters by the shared search prop (keyPath OR
 * value), and supports inline edit per row (pencil → textarea → Save). Save
 * goes through patchSource; the server's parity guard refuses (409) a
 * single-locale write of a key absent from the sibling locale, which we
 * surface inline pointing the admin at "Add key".
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Save, X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { HttpError, fetchSource, patchSource } from "../api"
import { flattenSource, type FlattenedSourceEntry } from "./import-schema"

interface SourceBrowserProps {
  locale: "en" | "ar"
  namespace: string
  search: string
}

const PARITY_MESSAGE = "This key is missing in the other locale; use Add key to create it in both."

export function SourceBrowser({ locale, namespace, search }: SourceBrowserProps): React.ReactNode {
  const [rows, setRows] = useState<FlattenedSourceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const source = await fetchSource(locale, namespace)
      setRows(flattenSource(source))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load translations")
    } finally {
      setLoading(false)
    }
  }, [locale, namespace])

  useEffect(() => {
    setEditingKey(null)
    setDraft("")
    setRowError(null)
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows
      .filter(r => !needle || r.keyPath.toLowerCase().includes(needle) || r.value.toLowerCase().includes(needle))
      .sort((a, b) => a.keyPath.localeCompare(b.keyPath))
  }, [rows, search])

  const startEdit = (keyPath: string, current: string) => {
    setRowError(null)
    setEditingKey(keyPath)
    setDraft(current)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraft("")
    setRowError(null)
  }

  const handleSave = async (keyPath: string) => {
    setBusy(true)
    setRowError(null)
    try {
      await patchSource(locale, namespace, keyPath, draft)
      cancelEdit()
      await reload()
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        setRowError(PARITY_MESSAGE)
      } else {
        setRowError(err instanceof Error ? err.message : "Failed to save")
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading || error || filtered.length === 0) {
    return (
      <StateScreen
        loading={loading}
        error={error}
        empty={rows.length === 0}
        onRetry={() => void reload()}
      />
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 sticky top-0">
        <tr>
          <th className="text-start p-2 font-medium w-1/3">Key</th>
          <th className="text-start p-2 font-medium">Value</th>
          <th className="text-end p-2 font-medium w-24">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map(row => (
          <SourceRow
            key={row.keyPath}
            keyPath={row.keyPath}
            value={row.value}
            editing={editingKey === row.keyPath}
            draft={draft}
            busy={busy}
            rowError={editingKey === row.keyPath ? rowError : null}
            onDraftChange={setDraft}
            onStartEdit={() => startEdit(row.keyPath, row.value)}
            onCancel={cancelEdit}
            onSave={() => handleSave(row.keyPath)}
          />
        ))}
      </tbody>
    </table>
  )
}

function StateScreen({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean
  error: string | null
  empty: boolean
  onRetry: () => void
}) {
  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  if (error) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        {error}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {empty ? "This namespace has no translations." : "No matches."}
    </div>
  )
}

interface SourceRowProps {
  keyPath: string
  value: string
  editing: boolean
  draft: string
  busy: boolean
  rowError: string | null
  onDraftChange: (v: string) => void
  onStartEdit: () => void
  onCancel: () => void
  onSave: () => void
}

function SourceRow({
  keyPath,
  value,
  editing,
  draft,
  busy,
  rowError,
  onDraftChange,
  onStartEdit,
  onCancel,
  onSave,
}: SourceRowProps) {
  return (
    <tr className="border-t border-border align-top">
      <td className="p-2 font-mono text-xs">{keyPath}</td>
      <td className="p-2">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              rows={3}
              className="w-full p-2 border border-border rounded bg-background text-sm font-mono"
              disabled={busy}
            />
            {rowError && <p className="mt-1 text-xs text-destructive">{rowError}</p>}
          </>
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
            <Button size="icon" variant="ghost" onClick={onStartEdit} disabled={busy}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
