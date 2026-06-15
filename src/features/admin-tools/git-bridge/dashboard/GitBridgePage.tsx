"use client"

/**
 * /admin/git — dev-only git surface.
 *
 * Two regions:
 *
 *   - Status panel: changed files grouped by category, each row has a
 *     checkbox + a revert button. (A "Diff" modal is scoped for a
 *     follow-up PR — the API surface for it already exists.)
 *
 *   - Action bar: branch picker + commit message + "Commit" /
 *     "Commit and push" buttons. The protected-branch banner shows up
 *     when the current branch is in GIT_PROTECTED_BRANCHES — with a
 *     one-click "Create feature branch" shortcut.
 *
 * Permission gate is server-side (route handlers refuse 403); the page
 * also hides itself for non-admins as a UX nicety.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, GitBranch, RefreshCw, ShieldAlert, Trash2, Upload } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import {
  commitChanges,
  createBranch,
  fetchBranches,
  fetchStatus,
  revertPaths,
  type CommitResponse,
  type GitStatusEntry,
  type GitStatusReport,
} from "./api-client"
import { DiffModal } from "./DiffModal"

const CATEGORY_LABELS = {
  translations: "Translations",
  entities: "Entities",
  pages: "Pages",
  other: "Other",
} as const

// State + handlers extracted into a hook so `GitBridgePage` stays under the
// max-lines-per-function gate. All mutation funnels through here; the
// component is just gating + JSX.
function useGitBridgeController() {
  const [status, setStatus] = useState<GitStatusReport | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = useState("")
  const [targetBranch, setTargetBranch] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [s, b] = await Promise.all([fetchStatus(), fetchBranches()])
      setStatus(s)
      setBranches(b.map(x => x.name))
      setTargetBranch(prev => prev || s.branch)
      setSelected(prev => new Set(Array.from(prev).filter(p => s.entries.some(e => e.path === p))))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load git state")
    }
  }, [])

  const handleCommit = useCallback(
    async (push: boolean) => {
      setError(null)
      setResult(null)
      setBusy(true)
      try {
        const r = await commitChanges({
          message: commitMessage,
          files: Array.from(selected),
          branch: targetBranch === status?.branch ? undefined : targetBranch,
          push,
        })
        setResult(r)
        setCommitMessage("")
        setSelected(new Set())
        void reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Commit failed")
      } finally {
        setBusy(false)
      }
    },
    [commitMessage, selected, targetBranch, status?.branch, reload],
  )

  const handleRevertSelected = useCallback(async () => {
    if (selected.size === 0) return
    setBusy(true)
    try {
      await revertPaths(Array.from(selected))
      setSelected(new Set())
      void reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revert failed")
    } finally {
      setBusy(false)
    }
  }, [selected, reload])

  return {
    status,
    branches,
    selected,
    setSelected,
    commitMessage,
    setCommitMessage,
    targetBranch,
    setTargetBranch,
    error,
    result,
    busy,
    reload,
    handleCommit,
    handleRevertSelected,
  }
}

export function GitBridgePage(): React.ReactNode {
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const c = useGitBridgeController()
  // Diff preview state: an array of paths to preview, or [] when the
  // modal is closed. A single-row click sets [path]; the toolbar
  // "View selected diffs" button sets the current selection's paths.
  const [diffPaths, setDiffPaths] = useState<readonly string[]>([])

  useEffect(() => {
    if (!isLoading) void c.reload()
  }, [isLoading, c.reload]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading permissions…</div>
  if (!isAdmin && !isGranted(PERMISSIONS.ADMIN_GIT_OPERATIONS)) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <p className="font-semibold">You don&apos;t have permission to perform git operations.</p>
        <p className="text-xs text-muted-foreground mt-1">Required: {PERMISSIONS.ADMIN_GIT_OPERATIONS}</p>
      </div>
    )
  }
  if (!c.status) return <div className="p-8 text-center text-sm text-muted-foreground">Loading git state…</div>

  return (
    <div className="p-6 space-y-4">
      <Header status={c.status} onReload={c.reload} />
      <ProtectedBranchBanner status={c.status} onSwitched={c.reload} />
      <StatusPanel
        status={c.status}
        selected={c.selected}
        onPreviewDiff={p => setDiffPaths([p])}
        onPreviewSelected={() => setDiffPaths([...c.selected])}
        onToggle={p =>
          c.setSelected(prev => {
            const next = new Set(prev)
            if (next.has(p)) next.delete(p)
            else next.add(p)
            return next
          })
        }
        onSelectAll={() => c.setSelected(new Set(c.status!.entries.map(e => e.path)))}
        onClear={() => c.setSelected(new Set())}
      />
      <CommitBar
        branches={c.branches}
        currentBranch={c.status.branch}
        targetBranch={c.targetBranch}
        setTargetBranch={c.setTargetBranch}
        commitMessage={c.commitMessage}
        setCommitMessage={c.setCommitMessage}
        selected={c.selected}
        busy={c.busy}
        onSubmit={c.handleCommit}
        onRevertSelected={c.handleRevertSelected}
      />
      {c.error && <p className="text-sm text-destructive">{c.error}</p>}
      {c.result && <CommitResultBanner result={c.result} />}
      <DiffModal open={diffPaths.length > 0} onOpenChange={open => !open && setDiffPaths([])} paths={diffPaths} />
    </div>
  )
}

function Header({ status, onReload }: { status: GitStatusReport; onReload: () => void }) {
  const totalChanged = status.entries.length
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Git status</h1>
          <p className="text-xs text-muted-foreground">
            On <span className="font-mono">{status.branch}</span> · {totalChanged} change
            {totalChanged === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onReload} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </header>
  )
}

function ProtectedBranchBanner({ status, onSwitched }: { status: GitStatusReport; onSwitched: () => void }) {
  const protectedPattern = /^(main|master|production)$/
  if (!protectedPattern.test(status.branch)) return null
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between flex-wrap gap-2">
      <span>
        You&apos;re on <span className="font-mono">{status.branch}</span> — a protected branch. Commits will be refused
        until you switch.
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const name = window.prompt("New branch name (kebab-case):")?.trim()
          if (!name) return
          await createBranch(name)
          onSwitched()
        }}
      >
        Create feature branch
      </Button>
    </div>
  )
}

function StatusPanel({
  status,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onPreviewDiff,
  onPreviewSelected,
}: {
  status: GitStatusReport
  selected: Set<string>
  onToggle: (p: string) => void
  onSelectAll: () => void
  onClear: () => void
  onPreviewDiff: (path: string) => void
  onPreviewSelected: () => void
}) {
  const grouped = useMemo(() => groupByCategory(status.entries), [status.entries])
  if (status.entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No changes in tracked paths.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Changed files ({status.entries.length})</CardTitle>
        <div className="flex gap-2 text-xs">
          <Button size="sm" variant="ghost" onClick={onSelectAll}>
            Select all
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onPreviewSelected}
            disabled={selected.size === 0}
            className="gap-1"
            title={selected.size === 0 ? "Select files first" : `View diff for ${selected.size} selected file(s)`}
          >
            <Eye className="h-3.5 w-3.5" />
            View selected diffs
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map(([category, items]) => (
          <section key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {CATEGORY_LABELS[category]} ({items.length})
            </h3>
            <ul className="space-y-1">
              {items.map(entry => (
                <li key={entry.path} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.path)}
                    onChange={() => onToggle(entry.path)}
                    aria-label={`select ${entry.path}`}
                  />
                  <span className={`inline-block w-3 h-3 rounded-full ${kindDot(entry.kind)}`} aria-hidden />
                  <code className="text-xs flex-1 truncate">{entry.path}</code>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{entry.kind}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onPreviewDiff(entry.path)}
                    title={`Preview diff for ${entry.path}`}
                    aria-label={`preview diff for ${entry.path}`}
                    className="h-7 w-7 p-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}

function groupByCategory(entries: GitStatusEntry[]): [GitStatusEntry["category"], GitStatusEntry[]][] {
  const map = new Map<GitStatusEntry["category"], GitStatusEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.category) ?? []
    arr.push(e)
    map.set(e.category, arr)
  }
  const order: GitStatusEntry["category"][] = ["translations", "entities", "pages", "other"]
  return order.filter(c => map.has(c)).map(c => [c, map.get(c)!] as [GitStatusEntry["category"], GitStatusEntry[]])
}

function kindDot(kind: GitStatusEntry["kind"]): string {
  switch (kind) {
    case "added":
    case "untracked":
      return "bg-success"
    case "modified":
    case "renamed":
      return "bg-warning"
    case "deleted":
      return "bg-destructive"
    default:
      return "bg-muted"
  }
}

interface CommitBarProps {
  branches: string[]
  currentBranch: string
  targetBranch: string
  setTargetBranch: (b: string) => void
  commitMessage: string
  setCommitMessage: (m: string) => void
  selected: Set<string>
  busy: boolean
  onSubmit: (push: boolean) => void | Promise<void>
  onRevertSelected: () => void | Promise<void>
}

function CommitBar({
  branches,
  currentBranch,
  targetBranch,
  setTargetBranch,
  commitMessage,
  setCommitMessage,
  selected,
  busy,
  onSubmit,
  onRevertSelected,
}: CommitBarProps) {
  const canCommit = selected.size > 0 && commitMessage.trim().length > 0 && !busy
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="git-branch" className="text-xs font-medium text-muted-foreground">
              Target branch
            </label>
            <Input
              id="git-branch"
              list="git-branch-options"
              value={targetBranch}
              onChange={e => setTargetBranch(e.target.value)}
              placeholder={currentBranch}
              className="font-mono text-sm"
            />
            <datalist id="git-branch-options">
              {branches.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Leave blank to commit to the current branch. New names are created on submit.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Selected files</p>
            <p className="text-sm">
              {selected.size} file{selected.size === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="git-message" className="text-xs font-medium text-muted-foreground">
            Commit message
          </label>
          <Textarea
            id="git-message"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder="e.g. fix(translations): update brand labels"
            rows={3}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button disabled={!canCommit} onClick={() => void onSubmit(false)}>
            Commit
          </Button>
          <Button disabled={!canCommit} variant="outline" onClick={() => void onSubmit(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Commit and push
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            disabled={selected.size === 0 || busy}
            onClick={() => void onRevertSelected()}
            className="gap-2 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Revert selected
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CommitResultBanner({ result }: { result: CommitResponse }) {
  const remoteBase = process.env.NEXT_PUBLIC_GIT_REMOTE_BASE_URL ?? ""
  const url = remoteBase && result.commitHash ? `${remoteBase}/commit/${result.commitHash}` : null
  return (
    <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success space-y-1">
      <p>
        Committed <span className="font-mono">{result.commitHash.slice(0, 8)}</span> to{" "}
        <span className="font-mono">{result.targetBranch}</span>
        {result.pushed ? " · pushed to origin" : null}
      </p>
      {result.pushError && <p className="text-xs text-destructive">Push failed: {result.pushError.slice(0, 200)}</p>}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
          Open commit in GitHub
        </a>
      )}
    </div>
  )
}
