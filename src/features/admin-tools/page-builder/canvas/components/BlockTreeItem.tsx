"use client"

/**
 * Recursive node renderer for the canvas tree. Each item draws a
 * one-row header (drag handle / chevron / label / Move ↑↓ / ⋮ menu)
 * plus, when the block is a container and `expandedIds` includes its
 * id, the list of its slots — each rendered through `BlockTreeSlot`.
 *
 * Path discipline:
 *   - `path` is this item's full path from the root.
 *   - `parentPath` and `slot` for Move ↑↓ are derived inside the item
 *     (parentPath is `path.slice(0,-1)` or null at root; slot is the
 *     last segment of `path`).
 *
 * Slot label visibility:
 *   - shown for tabs / accordion (one slot per tab/item, each carries a
 *     meaningful label)
 *   - hidden for card / grid (single anonymous body slot)
 *   - decided here via `getContainerKind(block)`.
 *
 * Drag-and-drop:
 *   - `useSortable` registers this item with the nearest
 *     `SortableContext` (root in BlockTree, or per-slot in
 *     BlockTreeSlot). The full `path` rides along as `data` so the
 *     drag-end handler can compute source + target without re-walking
 *     the schema.
 *   - The `<li>` is the visual drag target (`setNodeRef`, transform).
 *     Pointer listeners go on `DragHandle` only — the rest of the row
 *     keeps its click semantics (select / Move buttons / ⋮ menu).
 */

import { memo, useMemo } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"
import { asBlockNode, getContainerKind, getContainerSlots, isContainer, type BlockPath } from "../tree"
import { blockRegistry } from "../../registry/block-registry"
import type { BlockSchema } from "../../schema/block-schema"
import type { useCanvasState } from "../hooks/useCanvasState"
import { BlockActionsMenu } from "./BlockActionsMenu"
import { BlockTreeSlot } from "./BlockTreeSlot"
import { DragHandle } from "./DragHandle"

export interface BlockTreeItemProps {
  block: BlockSchema
  path: BlockPath
  depth: number
  state: ReturnType<typeof useCanvasState>
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  siblingCount: number
  siblingIndex: number
}

function humanize(type: string): string {
  return type
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function BlockTreeItemImpl(props: BlockTreeItemProps) {
  const { block, path, depth, state, expandedIds, onToggleExpand, siblingCount, siblingIndex } = props
  const node = asBlockNode(block)
  const containsChildren = isContainer(block)
  const expanded = expandedIds.has(node.id)
  const slots = useMemo(() => (containsChildren ? getContainerSlots(block) : []), [block, containsChildren])
  const kind = getContainerKind(block)
  const showSlotLabels = kind === "tabs" || kind === "accordion"

  const sortable = useSortable({
    id: node.id,
    data: { path },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  }

  // Drop-line indicator. dnd-kit sets `isOver` on the
  // sortable target the cursor is currently over; we render a 2px
  // primary-coloured line above the item via a ::before pseudo-element.
  // Position is "always above" for now; computing above-vs-below from
  // pointer geometry is parked for a future polish pass.
  const dropLineClass = sortable.isOver
    ? "before:content-[''] before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:rounded-full before:transition-all before:duration-150"
    : ""

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      data-testid={`tree-item-li-${node.id}`}
      data-over={sortable.isOver ? "true" : undefined}
      className={cn("relative", dropLineClass)}
    >
      <BlockTreeRow
        block={block}
        path={path}
        depth={depth}
        state={state}
        expanded={expanded}
        containsChildren={containsChildren}
        onToggleExpand={onToggleExpand}
        siblingCount={siblingCount}
        siblingIndex={siblingIndex}
        dragListeners={sortable.listeners}
        dragAttributes={sortable.attributes}
      />
      {containsChildren && expanded && (
        <ul className="space-y-1 mt-1" data-testid={`tree-children-${node.id}`}>
          {slots.map(slotEntry => (
            <BlockTreeSlot
              key={`${node.id}-${slotEntry.segment.kind}-${slotEntry.slotLabel}`}
              slotEntry={slotEntry}
              parentPath={path}
              depth={depth + 1}
              state={state}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              showSlotLabel={showSlotLabels}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

BlockTreeItemImpl.displayName = "BlockTreeItem"

/**
 * Custom equality function for `React.memo`. Skips re-render unless one
 * of the fields the item actually reads has changed. `state` itself
 * gets a new reference on every mutation, but the only state-derived
 * value this item paints with is `state.selectedId === thisBlockId` —
 * so we extract that boolean and compare only it. Same trick for
 * `expandedIds`: the Set reference changes on every toggle, but only
 * `expandedIds.has(thisBlockId)` matters here.
 *
 * Without memoisation, a 100-block tree triggers 100 re-renders per
 * mutation; with this guard each mutation re-renders only the affected
 * subtree. The comparator stays O(1) per item.
 */
function arePropsEqual(prev: BlockTreeItemProps, next: BlockTreeItemProps): boolean {
  if (prev.block !== next.block) return false
  if (prev.depth !== next.depth) return false
  if (prev.siblingIndex !== next.siblingIndex) return false
  if (prev.siblingCount !== next.siblingCount) return false
  if (prev.path.length !== next.path.length) return false
  if (prev.onToggleExpand !== next.onToggleExpand) return false

  const thisId = (prev.block as { id: string }).id
  if ((prev.state.selectedId === thisId) !== (next.state.selectedId === thisId)) return false
  if (prev.expandedIds.has(thisId) !== next.expandedIds.has(thisId)) return false
  // state functions (selectBlock, moveBlock, ...) are `useCallback`'d
  // inside useCanvasState, so passing the new `state` object alone
  // doesn't change those identities — and this item doesn't read any
  // other field off `state` during render.
  return true
}

export const BlockTreeItem = memo(BlockTreeItemImpl, arePropsEqual)

// ─── One-row header: handle / chevron / label / Move ↑↓ / ⋮ ────────────

interface RowProps {
  block: BlockSchema
  path: BlockPath
  depth: number
  state: ReturnType<typeof useCanvasState>
  expanded: boolean
  containsChildren: boolean
  onToggleExpand: (id: string) => void
  siblingCount: number
  siblingIndex: number
  dragListeners: ReturnType<typeof useSortable>["listeners"]
  dragAttributes: ReturnType<typeof useSortable>["attributes"]
}

function BlockTreeRow(props: RowProps) {
  const {
    block,
    path,
    depth,
    state,
    expanded,
    containsChildren,
    onToggleExpand,
    siblingCount,
    siblingIndex,
    dragListeners,
    dragAttributes,
  } = props
  const node = asBlockNode(block)
  const isSelected = state.selectedId === node.id
  const def = blockRegistry.get(node.type)
  const label = def?.displayName.en ?? humanize(node.type)
  const parentPath = path.length > 1 ? path.slice(0, -1) : null
  const slot = path[path.length - 1]!

  const moveUp = () => state.moveBlock(path, parentPath, slot, siblingIndex - 1)
  const moveDown = () => state.moveBlock(path, parentPath, slot, siblingIndex + 1)

  return (
    <div
      className="flex items-center gap-1 py-1"
      style={{ paddingInlineStart: `${depth * 0.5}rem` }}
      data-testid={`tree-row-${node.id}`}
    >
      <DragHandle
        blockId={node.id}
        blockLabel={label}
        siblingIndex={siblingIndex}
        siblingCount={siblingCount}
        listeners={dragListeners}
        attributes={dragAttributes}
      />
      {containsChildren ? (
        <Button
          size="iconSm"
          variant="ghost"
          onClick={() => onToggleExpand(node.id)}
          data-testid={`tree-expand-${node.id}`}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      ) : (
        <span className="w-7 shrink-0" aria-hidden />
      )}

      <button
        type="button"
        onClick={() => state.selectBlock(node.id)}
        className={cn(
          "flex flex-1 items-center justify-between rounded border px-2 py-1.5 text-start",
          isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent",
        )}
        data-testid={`tree-item-${node.id}`}
        data-block-type={node.type}
      >
        <span className="text-sm font-medium">{label}</span>
        <span className="ms-2 text-xs font-mono text-muted-foreground/70">{node.id}</span>
      </button>

      <Button
        size="iconSm"
        variant="ghost"
        disabled={siblingIndex === 0}
        onClick={moveUp}
        data-testid={`tree-move-up-${node.id}`}
        aria-label="Move up"
      >
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button
        size="iconSm"
        variant="ghost"
        disabled={siblingIndex >= siblingCount - 1}
        onClick={moveDown}
        data-testid={`tree-move-down-${node.id}`}
        aria-label="Move down"
      >
        <ArrowDown className="h-3 w-3" />
      </Button>

      <BlockActionsMenu block={block} path={path} state={state} />
    </div>
  )
}
