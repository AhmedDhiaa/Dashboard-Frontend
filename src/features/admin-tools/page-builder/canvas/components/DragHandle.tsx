"use client"

/**
 * Drag-grip icon rendered at the start of every block tree row. The
 * pointer listeners from `useSortable` MUST land on this element only —
 * placing them on the whole row would conflict with select-on-click,
 * Move ↑↓ buttons, and the actions menu, even with the 5px activation
 * threshold.
 *
 * Both `attributes` and `listeners` come from the parent's `useSortable`
 * call: attributes carry ARIA roles (role="button", aria-roledescription
 * "sortable") + tabIndex; listeners carry the pointer-event handlers
 * dnd-kit's MouseSensor needs.
 *
 * Accessibility: the aria-label is context-aware. The
 * parent passes the block's displayName + position in its slot, so a
 * screen-reader user hears "Drag Heading (item 2 of 5)" instead of
 * the static "Drag to reorder". Falls back gracefully when the parent
 * omits the optional context props.
 */

import { useMemo } from "react"
import { GripVertical } from "lucide-react"
import { type DraggableAttributes } from "@dnd-kit/core"
import { type SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

export interface DragHandleProps {
  blockId: string
  /** Human label (e.g. block displayName) used in the aria-label. */
  blockLabel?: string
  /** Zero-based position in the parent slot, for "item N of M" phrasing. */
  siblingIndex?: number
  /** Total siblings in the parent slot, for "item N of M" phrasing. */
  siblingCount?: number
  listeners?: SyntheticListenerMap
  attributes?: DraggableAttributes
}

export function DragHandle({
  blockId,
  blockLabel,
  siblingIndex,
  siblingCount,
  listeners,
  attributes,
}: DragHandleProps) {
  const ariaLabel = useMemo(() => {
    const base = blockLabel ? `Drag ${blockLabel}` : "Drag to reorder"
    if (siblingIndex !== undefined && siblingCount !== undefined) {
      return `${base} (item ${siblingIndex + 1} of ${siblingCount})`
    }
    return base
  }, [blockLabel, siblingIndex, siblingCount])

  return (
    <button
      type="button"
      className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
      data-testid={`tree-drag-handle-${blockId}`}
      aria-label={ariaLabel}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3" />
    </button>
  )
}
