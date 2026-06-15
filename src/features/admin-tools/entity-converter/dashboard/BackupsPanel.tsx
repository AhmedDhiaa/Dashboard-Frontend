"use client"

/**
 * Lists every snapshot from `.entity-builder-backups/` newest-first with a
 * Restore button per row. Restore is double-confirmed (browser confirm)
 * because it overwrites the live source tree.
 */

import { useEffect, useState } from "react"
import { History, RotateCcw } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { API_ROUTES } from "@/shared/api/routes"

interface Snapshot {
  id: string
  fileCount: number
}

export interface BackupsPanelProps {
  /**
   * Snapshots fetched server-side and passed in as initial state.
   *
   * When provided, the panel skips its first client-side fetch — every
   * byte of the visible list ships in the initial HTML. The Restore
   * action still uses fetch since it's user-initiated.
   *
   * When omitted (the legacy entity-builder dashboard's call site), the
   * panel falls back to the original client-fetched behaviour.
   */
  initialSnapshots?: readonly Snapshot[]
}

export function BackupsPanel({ initialSnapshots }: BackupsPanelProps = {}): React.ReactNode {
  const hasInitial = initialSnapshots !== undefined
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots ? [...initialSnapshots] : [])
  // When snapshots ship in initial HTML the panel is already populated;
  // we only need a "loading" state for the cold-start case.
  const [loading, setLoading] = useState(!hasInitial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_ROUTES.entityBuilder.backups, { cache: "no-store" })
      if (!res.ok) throw new Error(`List failed (${res.status})`)
      const data = (await res.json()) as { snapshots: Snapshot[] }
      setSnapshots(data.snapshots)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshots")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasInitial) return
    void reload()
  }, [hasInitial])

  const handleRestore = async (id: string) => {
    if (!window.confirm(`Restore snapshot ${id}? This overwrites the current source tree.`)) return
    setBusyId(id)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(API_ROUTES.entityBuilder.backup(id), { method: "POST" })
      if (!res.ok) throw new Error(`Restore failed (${res.status}): ${await res.text()}`)
      const data = (await res.json()) as { restored: string[] }
      setSuccess(`Restored ${data.restored.length} file(s) from ${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="border border-border rounded-md p-4 space-y-3">
      <header className="flex items-center gap-2">
        <History className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Backups ({snapshots.length})</h3>
      </header>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-primary">{success}</p>}
      {!loading && snapshots.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No snapshots yet. Each successful generation creates one (last 20 kept).
        </p>
      )}
      <ul className="space-y-1 max-h-96 overflow-y-auto">
        {snapshots.map(s => (
          <li key={s.id} className="flex items-center gap-2 p-2 border border-border rounded">
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono">{s.id}</code>
              <p className="text-[10px] text-muted-foreground">{s.fileCount} file(s)</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleRestore(s.id)} disabled={busyId === s.id}>
              <RotateCcw className="h-3 w-3 me-1" />
              {busyId === s.id ? "Restoring…" : "Restore"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
