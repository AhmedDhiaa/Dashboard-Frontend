"use client"

/**
 * Floating ghost rendered inside dnd-kit's `<DragOverlay>` while a
 * BlockTreeItem is being dragged. Stripped to a label + id + type
 * indicator on purpose — Move ↑↓ / ⋮ menu / chevron all carry no
 * meaning during drag, so re-rendering the full row would be visually
 * busy. The shadow + primary-tinted border lift the ghost off the
 * canvas so the placeholder (opacity 0.4 in the original row) and the
 * follow-cursor preview read as different things.
 */

import { Box } from "lucide-react"
import { asBlockNode } from "../tree"
import { blockRegistry } from "../../registry/block-registry"
import type { BlockSchema } from "../../schema/block-schema"

export interface DragOverlayPreviewProps {
  block: BlockSchema
}

export function DragOverlayPreview({ block }: DragOverlayPreviewProps) {
  const node = asBlockNode(block)
  const def = blockRegistry.get(node.type)
  const label = def?.displayName.en ?? humanize(node.type)

  return (
    <div
      className="flex max-w-xs cursor-grabbing items-center gap-2 rounded-md border border-primary/40 bg-card px-3 py-2 shadow-2xl shadow-primary/20"
      data-testid="drag-overlay-preview"
      data-block-type={node.type}
    >
      <Box className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-xs font-mono text-muted-foreground/70">{node.id}</div>
      </div>
    </div>
  )
}

function humanize(type: string): string {
  return type
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
