"use client"

/**
 * Dotted-border placeholder rendered in two situations:
 *   - the entire page schema has no blocks (BlockTree root)
 *   - a container slot has no children (BlockTreeSlot)
 *
 * Both cases offer the same UX: descriptive text + a mini "+ Add"
 * dropdown sourced from the block registry. When `isOver` is true
 * (drag is hovering over the wrapping `useDroppable`) the placeholder
 * pulses with a primary tint so the admin sees the drop will land
 * here.
 */

import { cn } from "@/shared/utils"
import { AddChildMenu } from "./AddChildMenu"

export interface EmptyDropZoneProps {
  depth: number
  label: string
  onAdd: (blockType: string) => void
  /** Test id suffix to disambiguate multiple empty zones in the same tree. */
  testIdSuffix?: string
  /** Highlight + pulse when the wrapping droppable is hovered during drag. */
  isOver?: boolean
}

export function EmptyDropZone({ depth, label, onAdd, testIdSuffix = "root", isOver = false }: EmptyDropZoneProps) {
  return (
    <div
      style={{ paddingInlineStart: `${depth * 1.25}rem` }}
      data-testid={`tree-empty-${testIdSuffix}`}
      data-over={isOver ? "true" : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border-2 border-dashed px-3 py-2 text-xs transition-all duration-150",
          isOver
            ? "animate-pulse border-primary bg-primary/10 text-foreground"
            : "border-border/50 bg-muted/20 text-muted-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <AddChildMenu depth={0} onSelect={onAdd} label="Add" testIdSuffix={`empty-${testIdSuffix}`} />
      </div>
    </div>
  )
}
