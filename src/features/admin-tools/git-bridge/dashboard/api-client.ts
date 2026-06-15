/**
 * Thin browser client for /api/admin/git/* — kept separate from the UI
 * component so a test can mock fetch without rendering the page.
 */

export interface GitStatusEntry {
  path: string
  category: "translations" | "entities" | "pages" | "other"
  kind: "added" | "modified" | "deleted" | "untracked" | "renamed"
}

export interface GitStatusReport {
  branch: string
  entries: GitStatusEntry[]
  counts: Record<GitStatusEntry["kind"], number>
}

export interface BranchEntry {
  name: string
  current: boolean
}

/**
 * Mirrors `DiffResult` from the server (`server/diff.ts`). Re-declared
 * here rather than imported to avoid pulling the server module into the
 * client bundle — the server file imports `gitExec` which itself loads
 * `child_process`. Drift between the two shapes would surface as a type
 * error at the route handler's JSON serialisation, so they stay in sync
 * by code review.
 */
export interface GitDiffResponse {
  path: string
  diff: string
  truncated: boolean
  empty: boolean
}

export interface CommitResponse {
  targetBranch: string
  files: string[]
  binaryFiles: string[]
  protectedBranch: boolean
  commitHash: string
  pushed: boolean
  pushError: string | null
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ""
    try {
      const body = (await res.json()) as { error?: string; reason?: string }
      detail = body.error ?? body.reason ?? ""
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`)
  }
  return (await res.json()) as T
}

export async function fetchStatus(): Promise<GitStatusReport> {
  return jsonOrThrow(await fetch("/api/admin/git/status", { cache: "no-store" }))
}

export async function fetchBranches(): Promise<BranchEntry[]> {
  const data = await jsonOrThrow<{ branches: BranchEntry[] }>(
    await fetch("/api/admin/git/branch", { cache: "no-store" }),
  )
  return data.branches
}

export async function createBranch(name: string, from?: string): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/admin/git/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, from }),
    }),
  )
}

export async function commitChanges(input: {
  message: string
  files: string[]
  branch?: string
  push?: boolean
}): Promise<CommitResponse> {
  return jsonOrThrow(
    await fetch("/api/admin/git/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  )
}

export async function fetchDiff(filePath: string): Promise<GitDiffResponse> {
  return jsonOrThrow(await fetch(`/api/admin/git/diff?file=${encodeURIComponent(filePath)}`, { cache: "no-store" }))
}

export async function revertPaths(files: string[]): Promise<{ reverted: string[]; refused: string[] }> {
  return jsonOrThrow(
    await fetch("/api/admin/git/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    }),
  )
}
