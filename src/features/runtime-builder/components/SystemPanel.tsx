"use client"

/**
 * SystemPanel — Reset / Export / Import. Lives in its own panel because
 * it's destructive and doesn't belong next to the editing tabs.
 */

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Cloud, Download, RefreshCw, Upload } from "lucide-react"
import {
  exportConfig,
  importConfig,
  migrateLocalToServer,
  useRuntimeConfig,
  useRuntimeProvider,
  type MigrationReport,
} from "../store"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { ConfirmDialog } from "@/ui/design-system/primitives/ConfirmDialog"

// eslint-disable-next-line max-lines-per-function -- One settings panel, four cards, all related
export function SystemPanel() {
  const provider = useRuntimeProvider()
  const config = useRuntimeConfig()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null)

  // Detect whether this browser still has a local-only stash that hasn't
  // been migrated yet — only then is the migration card useful. We track
  // it as state so a successful migration removes the card immediately.
  const [hasLocalData, setHasLocalData] = useState(false)
  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return false
      if (window.localStorage.getItem("acme.runtime.config")) return true
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith("acme.runtime.data.")) return true
      }
      return false
    }
    setHasLocalData(check())
  }, [migrationReport])

  const handleMigrate = async () => {
    setMigrating(true)
    setMigrationReport(null)
    try {
      const report = await migrateLocalToServer()
      setMigrationReport(report)
    } finally {
      setMigrating(false)
    }
  }

  const handleExport = () => {
    const json = exportConfig(provider)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `acme-runtime-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    setImportError(null)
    setImportSuccess(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      importConfig(provider, text)
      setImportSuccess(true)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import config")
    } finally {
      // Reset so picking the same file again still triggers onChange
      e.target.value = ""
    }
  }

  const totalRecords = config.entities.reduce((sum, e) => {
    if (typeof window === "undefined") return sum
    try {
      const raw = window.localStorage.getItem(`acme.runtime.data.${e.id}`)
      if (!raw) return sum
      const items = JSON.parse(raw)
      return sum + (Array.isArray(items) ? items.length : 0)
    } catch {
      return sum
    }
  }, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {config.entities.length} entities · {config.pages.length} pages · {config.dashboards.length} dashboards ·{" "}
            {totalRecords} records · v{config.settings.version}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </CardTitle>
          <CardDescription>
            Download the entire runtime config — entity schemas, pages, dashboards, and all stored records — as a single
            JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export configuration
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </CardTitle>
          <CardDescription>
            Replace the current configuration with a previously exported JSON file. The UI updates immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={handleImportClick} className="gap-2">
            <Upload className="h-4 w-4" />
            Choose file...
          </Button>
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          {importSuccess && <p className="text-sm text-emerald-600">Configuration imported successfully.</p>}
        </CardContent>
      </Card>

      {hasLocalData && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Push local config to server
            </CardTitle>
            <CardDescription>
              This browser has runtime data in localStorage from before the server backend was wired up. Push it to the
              server so other admins see the same entities and records, then this browser&apos;s local copy will be
              cleared.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={handleMigrate} disabled={migrating} className="gap-2">
              <Cloud className="h-4 w-4" />
              {migrating ? "Migrating..." : "Push to server"}
            </Button>
            {migrationReport && (
              <div className="text-sm space-y-1">
                {migrationReport.errors.length === 0 ? (
                  <p className="text-emerald-600">
                    Migrated {migrationReport.entityCount} entities and {migrationReport.recordCount} records. Local
                    copy cleared.
                  </p>
                ) : (
                  <>
                    <p className="text-destructive">
                      Migration completed with {migrationReport.errors.length} error(s). Local copy kept so you can
                      retry.
                    </p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground">
                      {migrationReport.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Reset System
          </CardTitle>
          <CardDescription>
            Permanently delete every entity, page, dashboard, and stored record. The static built-in pages are not
            affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setConfirmReset(true)}
          >
            <RefreshCw className="h-4 w-4" />
            Reset everything
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all runtime data?"
        description="This wipes every entity, page, dashboard, and record. There is no undo."
        confirmText="Reset everything"
        variant="destructive"
        onConfirm={() => {
          provider.resetConfig()
          setConfirmReset(false)
        }}
      />
    </div>
  )
}
