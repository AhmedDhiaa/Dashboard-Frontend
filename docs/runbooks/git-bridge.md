# Git Bridge — `/admin/git`

Working-tree review surface for admins making source-tree writes from
the UI (translation source-write, materialize, convert, etc.).
Admin-only; gated behind `Api.Admin.GitOperations`. Lives only in
non-production builds — production materialize routes 404 by design.

## What the page shows

- **Header**: current branch + total changed-files count. Refresh
  button re-polls `/api/admin/git/status`.
- **Protected-branch banner**: appears when the current branch matches
  `main|master|production`. Commits are refused on protected branches;
  the banner offers a one-click "create feature branch" shortcut.
- **Status panel**: every modified / added / deleted / untracked /
  renamed file grouped by category (translations / entities / pages /
  other). Per row: checkbox (multi-select), kind dot, file path, kind
  label, **per-row Diff button** (eye icon).
- **Toolbar**: Select all / Clear / **View selected diffs** (opens the
  DiffModal with every checked path).
- **Commit bar**: branch picker + commit message + "Commit" or
  "Commit and push" buttons.

The Diff button surfaces the unified DiffModal (Part 3.4) — same
component that the materialize-dialog file list mounts. The modal
fetches `/api/admin/git/diff?file=<path>` in parallel for every selected
path; per-line styling paints additions, deletions, hunk headers, and
file headers in distinct token classes. Diffs over 200 KB are
truncated server-side with a visible "truncated" badge.

## Safety rails

- **Protected branches**: `main`, `master`, `production`. The commit
  endpoint refuses with HTTP 409; the banner pushes the admin to a
  feature branch first.
- **Allowlisted paths**: only files under
  `src/domains/`, `src/app/(dashboard)/`, `src/features/dashboard/widgets/`,
  `messages/`, `.entity-builder-backups/`, `.entity-builder-cache/` reach
  the commit. Anything outside is filtered out at the server (see
  `src/shared/utils/safe-path.ts`).
- **Binary files**: skipped on commit. The response surfaces them under
  `binaryFiles` so the admin can hand-commit if needed.
- **Push gate**: `--no-verify` is never applied; pre-push hooks run as
  usual. A failed push leaves the local commit intact and surfaces the
  push error verbatim in the response.

## Where to look when something fails

Three audit trails to check, in order:

1. **`.entity-builder-backups/_audit.jsonl`** — append-only JSONL of
   every convert, restore, registry-patch, and materialize attempt.
   Each line discriminates via `kind`. The `outcome` field
   (`success` | `failed` | `rolled-back` | `half-restored`) tells you
   whether the on-disk state was reverted.
2. **`.entity-builder-backups/<timestamp>/`** — rolling 20-snapshot
   ring buffer. Every mutating operation snapshots its target files
   here BEFORE writing. The `BackupsPanel` mounted on `/admin/entities`
   exposes these for one-click restore.
3. **Server logs** — `logger.error("[entity-converter:...]")`,
   `logger.error("[git-bridge]")`, etc. Most rollback / refusal paths
   log loudly even when they recover cleanly.

The web UI surfaces failures as toast notifications via
`useNotification.error(…)`; the toast text is the raw error message
from the server when one's available.

## Workflow: convert → review → commit

The intended loop after a UI write:

1. Make the change (convert / materialize / translation edit).
2. Wait for the toast: "Wrote N files - review in Git Bridge before
   committing". `useNotification` doesn't support clickable actions
   yet (Part 3.3 caveat), so the text mentions the Git Bridge but isn't
   linked — navigate there manually.
3. Open `/admin/git`. The N freshly-written files show up in the status
   panel. Click the eye icon on each row (or multi-select + "View
   selected diffs") to review the diffs inline.
4. If the protected-branch banner is up, click "create feature branch"
   first.
5. Type a commit message. Pick "Commit" or "Commit and push".
6. The PR review continues on GitHub as usual.

## API reference

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/admin/git/status` | GET | Working-tree status, grouped by category |
| `/api/admin/git/branch` | GET | List local branches |
| `/api/admin/git/branch` | POST | Create + check out a new branch |
| `/api/admin/git/diff?file=<path>` | GET | Unified diff for one allowlisted path, 200 KB cap |
| `/api/admin/git/commit` | POST | `{ message, files[], branch?, push? }` |
| `/api/admin/git/revert` | POST | `{ files[] }` — revert listed paths to HEAD |
