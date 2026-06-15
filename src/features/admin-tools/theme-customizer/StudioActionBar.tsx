"use client"

/**
 * The studio's action cluster — a tidy, grouped toolbar segment.
 *
 * Three visually-separated groups:
 *   1. File ops (Export / Import) — ghost, leading.
 *   2. Destructive ops (Reset / Revert) — subtly set apart, muted.
 *   3. Commit ops (Save draft / Publish) — Publish is the primary CTA.
 *
 * Import validates the parsed payload is a flat `Record<string, string>` of
 * `--token: value`. All wiring (state setters, file IO) is unchanged.
 */

import { useRef } from "react"
import { Download, RotateCcw, Save, Trash2, Upload, UploadCloud } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import type { CustomizerState } from "./useCustomizerState"

interface StudioActionBarProps {
  state: CustomizerState
  onImportError: (message: string) => void
  onImported: (count: number) => void
}

/** Validate + extract a `Record<string,string>` token map from parsed JSON. */
function parseTokenMap(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Expected a JSON object of \"--token\": \"value\" pairs.")
  }
  const entries = Object.entries(raw as Record<string, unknown>)
  const out: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      throw new Error(`Token "${key}" must be a string value, got ${typeof value}.`)
    }
    out[key] = value
  }
  return out
}

/** A subtle vertical divider that separates the action groups. */
function GroupDivider() {
  return <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
}

/** A ghost icon-button wrapped in a tooltip — the studio's compact action. */
function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="iconSm" onClick={onClick} disabled={disabled} aria-label={label}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function StudioActionBar({ state, onImportError, onImported }: StudioActionBarProps): React.ReactNode {
  const { version, dirtyCount, busy, draft } = state
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `theme-draft-v${version}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const tokens = parseTokenMap(JSON.parse(text))
      state.mergeDraft(tokens)
      onImported(Object.keys(tokens).length)
    } catch (err) {
      onImportError(err instanceof Error ? err.message : "Could not import theme JSON.")
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-1.5">
        <IconAction label="Export draft as JSON" icon={<Download />} onClick={handleExport} disabled={busy} />
        <IconAction
          label="Import a theme JSON file"
          icon={<Upload />}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ""
          }}
        />

        <GroupDivider />

        <IconAction
          label="Reset — clear every override (fall back to defaults)"
          icon={<Trash2 />}
          onClick={state.handleResetToDefaults}
          disabled={busy}
        />
        <IconAction
          label="Revert — discard draft, back to live"
          icon={<RotateCcw />}
          onClick={state.handleRevert}
          disabled={busy}
        />

        <GroupDivider />

        <Button variant="outline" size="sm" onClick={state.handleSaveDraft} disabled={busy} loading={busy}>
          <Save />
          <span className="hidden sm:inline">Save draft</span>
        </Button>
        <Button size="sm" onClick={state.handlePublish} disabled={busy || dirtyCount === 0} loading={busy}>
          <UploadCloud />
          Publish{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </div>
    </TooltipProvider>
  )
}
