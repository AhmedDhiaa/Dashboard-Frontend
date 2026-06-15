"use client"

/**
 * Two-step import flow:
 *   1. File picker → parse JSON → run `interpretImport` to detect which of
 *      the two accepted shapes the file uses (flat overrides export, or a
 *      source-shape slice). Source-shape is refused when the source-write
 *      gate is closed.
 *   2. Preview → on Confirm, batch the writes:
 *        - flat shape   → patchOverride per changed/added entry
 *        - source shape → patchSource  per flattened key (always written,
 *                         no diff baseline — see comment near the preview).
 *
 *   Removed entries are intentionally ignored — DELETE-on-import is
 *   destructive and warrants an explicit "Replace whole map" mode.
 */

import { useRef, useState } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { HttpError, patchOverride, patchSource } from "../api"
import { SOURCE_WRITE_ENABLED } from "../lib/write-mode"
import {
  diffOverrides,
  interpretImport,
  interpretRawNamespace,
  splitFlatKey,
  type DiffRow,
  type FlattenedSourceEntry,
  type InterpretResult,
} from "./import-schema"

interface ImportDialogProps {
  locale: "en" | "ar"
  currentOverrides: Record<string, string>
  onImported: () => void
}

/**
 * The preview state captures everything the user needs to confirm. For flat
 * imports we diff against `currentOverrides` so the modal shows old-vs-new;
 * for source imports we don't have a cheap baseline (it'd require fetching
 * /api/i18n/source-write?locale=&namespace=), so we render each flattened
 * entry as "added" and the count reflects what will be written.
 */
type ImportPreview =
  | { kind: "flat"; locale: "en" | "ar"; rows: DiffRow[]; sourceMap: Record<string, string> }
  | { kind: "source"; locale: "en" | "ar"; namespace: string; entries: FlattenedSourceEntry[]; fromRaw: boolean }

/** Infer the namespace from a raw messages file name: strip path + ".json" (case-insensitive). */
function namespaceFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName
  return base.replace(/\.json$/i, "").trim()
}

export function ImportDialog({ locale, currentOverrides, onImported }: ImportDialogProps): React.ReactNode {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setError("File is not valid JSON")
      return
    }
    const built = interpretFile(raw, file.name, locale, currentOverrides)
    if (built.kind === "error") setError(built.error)
    else setPreview(built.preview)
  }

  const close = () => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const confirmImport = async () => {
    if (!preview) return
    setBusy(true)
    try {
      if (preview.kind === "flat") {
        const toApply = preview.rows.filter(r => r.status === "added" || r.status === "changed")
        for (const row of toApply) {
          const { namespace, keyPath } = splitFlatKey(row.flatKey)
          await patchOverride(locale, namespace, keyPath, row.newValue ?? "")
        }
      } else {
        // Source-shape import writes a single locale. The server's parity guard
        // refuses (409) any key absent from the sibling locale, so we apply the
        // edits that DO exist in both locales and collect the new keys to report
        // — rather than silently breaking the en/ar parity gate.
        const { written, skipped } = await applySourceImport(locale, preview.namespace, preview.entries)
        onImported()
        if (skipped.length > 0) {
          const sample = skipped.slice(0, 5).join(", ")
          setError(
            `Updated ${written} existing key${written === 1 ? "" : "s"}. Skipped ${skipped.length} new ` +
              `key${skipped.length === 1 ? "" : "s"} that need both locales — create them with "Add key": ` +
              `${sample}${skipped.length > 5 ? "…" : ""}`,
          )
          return // keep the modal open so the admin sees what was skipped
        }
        close()
        return
      }
      onImported()
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        className="gap-2"
        title={
          SOURCE_WRITE_ENABLED
            ? "Import an exported overrides file, or a raw messages/<locale>/<ns>.json file (namespace inferred from the file name)."
            : "Import an exported overrides file."
        }
      >
        <Upload className="h-4 w-4" />
        Import JSON
      </Button>

      {error && !preview && <ErrorModal message={error} onClose={close} />}

      {preview && (
        <PreviewModal preview={preview} busy={busy} error={error} onClose={close} onConfirm={confirmImport} />
      )}
    </>
  )
}

/**
 * Apply a source-shape import one key at a time. Keys the parity guard refuses
 * (HTTP 409 — absent from the sibling locale) are collected as `skipped` rather
 * than aborting the whole import; any other error propagates.
 */
async function applySourceImport(
  locale: "en" | "ar",
  namespace: string,
  entries: FlattenedSourceEntry[],
): Promise<{ written: number; skipped: string[] }> {
  const skipped: string[] = []
  let written = 0
  for (const entry of entries) {
    try {
      await patchSource(locale, namespace, entry.keyPath, entry.value)
      written++
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        skipped.push(entry.keyPath)
        continue
      }
      throw err
    }
  }
  return { written, skipped }
}

interface BuildPreviewError {
  kind: "error"
  error: string
}

interface BuildPreviewOk {
  kind: "ok"
  preview: ImportPreview
}

/**
 * Translate the InterpretResult into a renderable ImportPreview. Pulled out
 * so the locale-mismatch check sits with the other validation rather than
 * scattered through the dialog's event handler.
 */
function buildPreview(
  result: InterpretResult,
  currentLocale: "en" | "ar",
  currentOverrides: Record<string, string>,
  fromRaw: boolean,
): BuildPreviewOk | BuildPreviewError {
  if (result.kind === "error") return { kind: "error", error: result.error }
  if (result.locale !== currentLocale) {
    return {
      kind: "error",
      error: `File is for locale "${result.locale}" but you're viewing "${currentLocale}". Switch locale first.`,
    }
  }
  if (result.kind === "flat") {
    return {
      kind: "ok",
      preview: {
        kind: "flat",
        locale: result.locale,
        rows: diffOverrides(currentOverrides, result.overrides),
        sourceMap: result.overrides,
      },
    }
  }
  return {
    kind: "ok",
    preview: { kind: "source", locale: result.locale, namespace: result.namespace, entries: result.flattened, fromRaw },
  }
}

/**
 * Interpret a parsed file into a preview. Tries the two declared import shapes
 * first; if neither matches and source-write is armed, falls back to treating
 * the file as a RAW messages namespace — `{ key: {…nested…} }` with no
 * envelope — inferring the namespace from the file name and the locale from
 * the current admin view (raw files carry no locale).
 */
function interpretFile(
  raw: unknown,
  fileName: string,
  locale: "en" | "ar",
  currentOverrides: Record<string, string>,
): BuildPreviewOk | BuildPreviewError {
  const result = interpretImport(raw, { sourceWriteEnabled: SOURCE_WRITE_ENABLED })
  if (result.kind === "error" && SOURCE_WRITE_ENABLED) {
    const rawResult = interpretRawNamespace(raw, locale, namespaceFromFileName(fileName))
    return buildPreview(rawResult, locale, currentOverrides, true)
  }
  return buildPreview(result, locale, currentOverrides, false)
}

function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
        <p className="text-sm text-destructive mb-4">{message}</p>
        <Button onClick={onClose} variant="outline" className="w-full">
          Close
        </Button>
      </div>
    </div>
  )
}

interface PreviewModalProps {
  preview: ImportPreview
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

function shapeLine(preview: ImportPreview): string {
  if (preview.kind === "flat") {
    const changes = preview.rows.filter(r => r.status !== "unchanged").length
    return `Detected: flat overrides — ${changes} change${changes === 1 ? "" : "s"} pending`
  }
  const count = preview.entries.length
  if (preview.fromRaw) {
    return (
      `Importing into ${preview.namespace} (${preview.locale}) from a raw messages file — ` +
      `${count} key${count === 1 ? "" : "s"} to write`
    )
  }
  return `Detected: source-shape (${preview.namespace}) — ${count} key${count === 1 ? "" : "s"} to write`
}

function pendingCount(preview: ImportPreview): number {
  if (preview.kind === "flat") return preview.rows.filter(r => r.status !== "unchanged").length
  return preview.entries.length
}

function PreviewModal({ preview, busy, error, onClose, onConfirm }: PreviewModalProps) {
  const count = pendingCount(preview)
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-semibold">Import preview ({preview.locale})</h2>
            <p className="text-xs text-muted-foreground">{shapeLine(preview)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-auto">
          {preview.kind === "flat" ? <DiffTable rows={preview.rows} /> : <SourceTable entries={preview.entries} />}
        </div>
        {error && <p className="px-4 text-sm text-destructive">{error}</p>}
        <footer className="p-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || count === 0}>
            {busy ? "Applying..." : `Confirm (${count})`}
          </Button>
        </footer>
      </div>
    </div>
  )
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 sticky top-0">
        <tr>
          <th className="text-start p-2 font-medium">Key</th>
          <th className="text-start p-2 font-medium">Old</th>
          <th className="text-start p-2 font-medium">New</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <DiffRowView key={row.flatKey} row={row} />
        ))}
      </tbody>
    </table>
  )
}

function DiffRowView({ row }: { row: DiffRow }) {
  const tone =
    row.status === "added"
      ? "bg-primary/5"
      : row.status === "changed"
        ? "bg-accent/10"
        : row.status === "removed"
          ? "bg-destructive/5"
          : ""
  return (
    <tr className={`border-t border-border ${tone}`}>
      <td className="p-2 font-mono text-xs align-top">{row.flatKey}</td>
      <td className="p-2 align-top text-xs whitespace-pre-wrap break-words">{row.oldValue ?? "—"}</td>
      <td className="p-2 align-top text-xs whitespace-pre-wrap break-words">{row.newValue ?? "—"}</td>
    </tr>
  )
}

function SourceTable({ entries }: { entries: FlattenedSourceEntry[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 sticky top-0">
        <tr>
          <th className="text-start p-2 font-medium">Key</th>
          <th className="text-start p-2 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => (
          <tr key={entry.keyPath} className="border-t border-border bg-primary/5">
            <td className="p-2 font-mono text-xs align-top">{entry.keyPath}</td>
            <td className="p-2 align-top text-xs whitespace-pre-wrap break-words">{entry.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
