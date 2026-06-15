"use client"

/**
 * Unified diff viewer surfaced from two places:
 *
 *   - The materialize-dialog file list ("Preview diff" on a registry row)
 *   - The /admin/git status panel (per-row "Diff" button)
 *
 * Pure read-only viewer — no edit, no comment, no save. The component
 * accepts a list of paths so a single trigger can preview multiple
 * files at once (used today from /admin/git's multi-select, if any).
 *
 * Renderer note: no `react-diff-viewer-continued` in deps and the spec
 * explicitly forbids installing one. The hand-rolled `<pre>` below
 * applies per-line classes based on the leading character — additions
 * use the success token, deletions use destructive, hunk headers
 * (`@@`) use info, file headers (`+++`/`---`/`diff --git`/`index`)
 * keep the muted-foreground token. Readable enough for human review;
 * the 200KB cap on the server side keeps the DOM bounded.
 */

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/design-system/primitives/dialog"
import { Button } from "@/ui/design-system/primitives/button"
import { FileCode, Loader2, RefreshCw } from "lucide-react"
import { fetchDiff, type GitDiffResponse } from "./api-client"

export interface DiffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paths: readonly string[]
}

export type DiffStatus = "added" | "modified" | "deleted" | "unchanged"

/** Derive a status label from the diff response shape. Used in the
 *  per-file header badge. Kept here (not in the server) so a future
 *  source-of-truth change on the server side doesn't break the UI. */
export function statusFromDiff(d: GitDiffResponse): DiffStatus {
  if (d.empty) return "unchanged"
  if (d.diff.includes("new file mode")) return "added"
  if (d.diff.includes("deleted file mode")) return "deleted"
  return "modified"
}

type LoadState = { kind: "loading" } | { kind: "loaded"; diffs: GitDiffResponse[] } | { kind: "error"; message: string }

export function DiffModal({ open, onOpenChange, paths }: DiffModalProps): React.ReactNode {
  const [state, setState] = useState<LoadState>({ kind: "loading" })

  const load = useCallback(async (target: readonly string[]) => {
    setState({ kind: "loading" })
    try {
      const diffs = await Promise.all(target.map(p => fetchDiff(p)))
      setState({ kind: "loaded", diffs })
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Failed to load diff" })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (paths.length === 0) {
      // Defensive: a caller shouldn't open us with zero paths, but
      // gracefully render the empty state rather than burning a fetch.
      setState({ kind: "loaded", diffs: [] })
      return
    }
    void load(paths)
  }, [open, paths, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            File diffs ({paths.length})
          </DialogTitle>
          <DialogDescription>
            Working-tree diff against HEAD. Diffs over 200 KB are truncated server-side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-3">
          <Body state={state} paths={paths} onRetry={() => void load(paths)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Body({
  state,
  paths,
  onRetry,
}: {
  state: LoadState
  paths: readonly string[]
  onRetry: () => void
}): React.ReactNode {
  if (state.kind === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading diffs…
      </div>
    )
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-3 py-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }
  if (state.diffs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        {paths.length === 0 ? "No files to diff." : "All selected files are unchanged."}
      </div>
    )
  }
  return (
    <>
      {state.diffs.map(d => (
        <DiffFileSection key={d.path} diff={d} />
      ))}
    </>
  )
}

function DiffFileSection({ diff }: { diff: GitDiffResponse }): React.ReactNode {
  const status = statusFromDiff(diff)
  return (
    <section className="rounded-md border border-border overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
        <code className="text-xs font-mono truncate flex-1">{diff.path}</code>
        <StatusBadge status={status} />
        {diff.truncated && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-warning/15 text-warning-foreground border border-warning/30"
            title="Server-side 200 KB cap reached"
          >
            truncated
          </span>
        )}
      </header>
      <DiffBody diff={diff} status={status} />
    </section>
  )
}

function DiffBody({ diff, status }: { diff: GitDiffResponse; status: DiffStatus }): React.ReactNode {
  if (status === "unchanged") {
    return <p className="px-3 py-6 text-center text-xs text-muted-foreground italic">No working-tree changes.</p>
  }
  return (
    <pre className="text-[11px] font-mono leading-relaxed max-h-[50vh] overflow-y-auto px-3 py-2 bg-background/60">
      {diff.diff.split("\n").map((line, i) => (
        <span key={i} className={lineClass(line)} data-line-kind={lineKind(line)}>
          {line}
          {"\n"}
        </span>
      ))}
    </pre>
  )
}

type LineKind = "addition" | "deletion" | "hunk" | "header" | "context"

function lineKind(line: string): LineKind {
  // Order matters: file headers begin with `+++`/`---` which share the
  // addition / deletion prefixes; check them first so the renderer
  // doesn't paint header lines red/green.
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git") || line.startsWith("index ")) {
    return "header"
  }
  if (line.startsWith("@@")) return "hunk"
  if (line.startsWith("+")) return "addition"
  if (line.startsWith("-")) return "deletion"
  return "context"
}

function lineClass(line: string): string {
  switch (lineKind(line)) {
    case "addition":
      return "block bg-success/10 text-success-foreground"
    case "deletion":
      return "block bg-destructive/10 text-destructive-foreground"
    case "hunk":
      return "block text-info"
    case "header":
      return "block text-muted-foreground"
    default:
      return "block"
  }
}

function StatusBadge({ status }: { status: DiffStatus }): React.ReactNode {
  const cls =
    status === "added"
      ? "bg-success/15 text-success-foreground border-success/30"
      : status === "deleted"
        ? "bg-destructive/15 text-destructive-foreground border-destructive/30"
        : status === "unchanged"
          ? "bg-muted text-muted-foreground border-border"
          : "bg-warning/15 text-warning-foreground border-warning/30"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${cls}`}>
      {status}
    </span>
  )
}
