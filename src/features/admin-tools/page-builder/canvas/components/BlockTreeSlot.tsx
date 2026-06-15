"use client"

/**
 * Container-slot wrapper rendered between a `BlockTreeItem` and its
 * children. Three roles:
 *   1. Optionally label the slot (tabs/accordion) so the admin sees
 *      which tab/item a child belongs to.
 *   2. Render the slot's children, plus the "+ Add child" affordance —
 *      either inline at the bottom of a populated slot, or as the body
 *      of an `EmptyDropZone` when the slot is empty.
 *   3. Act as a `useDroppable` target so dnd-kit can resolve drops on
 *      empty slots (and on the gap area of populated slots) — both
 *      surface as `{ type: "slot", parentPath, slot }` payloads to
 *      `useDragHandlers`. The drop zone wraps a single div whose ref
 *      is the same regardless of empty/populated branch; the
 *      conditional highlight class flips on `droppable.isOver`.
 *
 * Note on collision: dnd-kit's deepest-collision default means a drop
 * over a sortable item INSIDE this slot resolves to the item, not the
 * slot. Container highlight only fires when the cursor sits in the
 * slot's gap area or anywhere inside an empty slot — which is exactly
 * the UX the spec asks for (item gets a drop-line; slot gets a tint).
 */

import { useMemo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/shared/utils"
import { AddChildMenu } from "./AddChildMenu"
import { BlockTreeItem } from "./BlockTreeItem"
import { EmptyDropZone } from "./EmptyDropZone"
import { instantiateBlock } from "../utils/instantiateBlock"
import { asBlockNode } from "../tree"
import { encodePath } from "../dnd/path-encoding"
import type { BlockSchema } from "../../schema/block-schema"
import type { useCanvasState } from "../hooks/useCanvasState"
import type { BlockPath, PathSegment } from "../tree"

interface SlotEntry {
  segment: PathSegment
  blocks: BlockSchema[]
  slotLabel: string
}

export interface BlockTreeSlotProps {
  slotEntry: SlotEntry
  parentPath: BlockPath
  depth: number
  state: ReturnType<typeof useCanvasState>
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  showSlotLabel: boolean
}

export function BlockTreeSlot(props: BlockTreeSlotProps) {
  const { slotEntry, parentPath, depth, state, expandedIds, onToggleExpand, showSlotLabel } = props
  const { segment, blocks, slotLabel } = slotEntry
  const slotKey = segmentSlotKey(segment, slotLabel)
  const blockIds = useMemo(() => blocks.map(b => asBlockNode(b).id), [blocks])

  const droppable = useDroppable({
    id: `slot-${encodePath([...parentPath, segment])}`,
    data: {
      type: "slot",
      parentPath,
      slot: segment,
    },
  })

  const handleAdd = (type: string) => {
    const block = instantiateBlock(type)
    if (!block) return
    state.insertBlock(parentPath, segment, blocks.length, block)
  }

  return (
    <li className="space-y-1" data-testid={`tree-slot-${slotKey}`}>
      {showSlotLabel && (
        <div
          className="flex items-center gap-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          style={{ paddingInlineStart: `${depth * 0.5}rem` }}
        >
          <span data-testid={`tree-slot-label-${slotKey}`}>{slotLabel}</span>
        </div>
      )}
      <div
        ref={droppable.setNodeRef}
        className={cn("rounded transition-all duration-150", droppable.isOver && "bg-primary/5 ring-1 ring-primary/30")}
        data-testid={`tree-slot-droppable-${slotKey}`}
        data-over={droppable.isOver ? "true" : undefined}
      >
        {blocks.length === 0 ? (
          <EmptyDropZone
            depth={depth}
            label={`Empty ${slotLabel.toLowerCase()}`}
            onAdd={handleAdd}
            testIdSuffix={slotKey}
            isOver={droppable.isOver}
          />
        ) : (
          <ul className="space-y-1 ms-3 ps-2 border-s border-border/40">
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
              {blocks.map((child, index) => (
                <BlockTreeItem
                  key={(child as { id: string }).id}
                  block={child}
                  path={[...parentPath, { ...segment, index }]}
                  depth={depth}
                  state={state}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  siblingCount={blocks.length}
                  siblingIndex={index}
                />
              ))}
            </SortableContext>
            <li>
              <AddChildMenu depth={depth} onSelect={handleAdd} testIdSuffix={slotKey} />
            </li>
          </ul>
        )}
      </div>
    </li>
  )
}

function segmentSlotKey(segment: PathSegment, slotLabel: string): string {
  if (segment.kind === "tab") return `tab-${segment.tabId}`
  if (segment.kind === "item") return `item-${segment.itemId}`
  return `${segment.kind}-${slotLabel.toLowerCase().replace(/\s+/g, "-")}`
}
