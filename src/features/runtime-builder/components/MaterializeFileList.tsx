"use client"

/**
 * Grouped file listing for the materialize dialog. Splits the flat
 * "files about to land" array into two semantic sections — entity files
 * vs registry updates — so admins can spot at a glance that the patcher
 * is touching `permission-keys.ts` / `navigation.ts` in addition to the
 * entity sources.
 *
 * The per-row "Preview diff" button is a deliberate stub for Part 3.2.
 * The unified DiffModal that powers it is scheduled for Part 3.4; until
 * that ships, the buttons render visibly disabled with an explanatory
 * `title` attribute.
 */

import { useState } from "react"
import { FileCode, Eye } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { DiffModal } from "@/features/admin-tools/git-bridge/dashboard/DiffModal"

export type MaterializeFileKind = "entity" | "registry"

export interface MaterializeFile {
  path: string
  kind: MaterializeFileKind
}

export interface MaterializeFileListProps {
  files: readonly MaterializeFile[]
}

const REGISTRY_PATHS: readonly string[] = ["src/shared/auth/permission-keys.ts", "src/shared/config/navigation.ts"]

/** Classify a raw path string into one of the two render buckets. */
export function classifyMaterializeFile(path: string): MaterializeFileKind {
  return REGISTRY_PATHS.includes(path) ? "registry" : "entity"
}

export function MaterializeFileList({ files }: MaterializeFileListProps): React.ReactNode {
  const entity = files.filter(f => f.kind === "entity")
  const registry = files.filter(f => f.kind === "registry")
  // Single-path preview: a registry row's "Preview diff" click sets the
  // path; <DiffModal> opens for it. State at THIS level so both sections
  // share the same modal instance (rather than per-row modals).
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <FileSection title="Entity files" files={entity} showPreviewButton={false} onPreview={setPreviewPath} />
      <FileSection title="Registry updates" files={registry} showPreviewButton onPreview={setPreviewPath} />
      <DiffModal
        open={previewPath !== null}
        onOpenChange={open => !open && setPreviewPath(null)}
        paths={previewPath ? [previewPath] : []}
      />
    </div>
  )
}

function FileSection({
  title,
  files,
  showPreviewButton,
  onPreview,
}: {
  title: string
  files: readonly MaterializeFile[]
  showPreviewButton: boolean
  onPreview: (path: string) => void
}): React.ReactNode {
  if (files.length === 0) return null
  return (
    <section className="rounded-md border border-border bg-muted/10 overflow-hidden">
      <header className="px-3 py-2 border-b border-border bg-muted/30">
        <h3 className="text-xs font-semibold text-muted-foreground">
          {title} ({files.length})
        </h3>
      </header>
      <ul>
        {files.map(file => (
          <li
            key={file.path}
            className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border last:border-b-0"
          >
            <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
            <code className="text-xs font-mono truncate flex-1">{file.path}</code>
            {showPreviewButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPreview(file.path)}
                title={`Preview diff for ${file.path}`}
                className="text-xs gap-1"
              >
                <Eye className="h-3 w-3" />
                Preview diff
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
