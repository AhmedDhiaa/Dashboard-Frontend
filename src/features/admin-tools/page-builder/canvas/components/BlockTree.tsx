"use client"

/**
 * Recursive replacement for the flat `BlockList` from PageBuilderCanvas.
 *
 * Owns:
 *   - the per-container expand state (`Set<string>` keyed by block id),
 *     seeded by walking the schema once on mount and adding every
 *     container's id (default behaviour: everything expanded)
 *   - the root-level empty-state placeholder
 *   - the root iteration that hands each block to `BlockTreeItem`
 *
 * Consumers pass the full `useCanvasState` value down because almost
 * every node-level interaction (select, move, duplicate, delete, add)
 * dispatches against it. The hook output is a small set of memoised
 * callbacks plus a few primitives, so the prop reads are cheap.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { asBlockNode, isContainer, walkBlocks } from "../tree"
import { instantiateBlock } from "../utils/instantiateBlock"
import type { useCanvasState } from "../hooks/useCanvasState"
import { BlockTreeItem } from "./BlockTreeItem"
import { EmptyDropZone } from "./EmptyDropZone"

export interface BlockTreeProps {
  state: ReturnType<typeof useCanvasState>
}

export function BlockTree({ state }: BlockTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => seedExpanded(state.schema))

  // Prune stale expandedIds whenever the schema changes.
  // Without this, a `replaceSchema` (Swagger wizard) or `removeBlockAt`
  // on a container leaves "ghost" ids that would re-expand if the next
  // schema happened to reuse the same id. The cleanup skips a state
  // update when nothing was pruned to avoid an extra render cycle.
  useEffect(() => {
    const validIds = collectContainerIds(state.schema)
    setExpandedIds(prev => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (validIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [state.schema])

  // Stable identity so `BlockTreeItem`'s memo comparator can short-
  // circuit when only an unrelated property of `state` changes. Without
  // useCallback, every BlockTree render hands every item a new function
  // reference and the memo comparator's `prev.onToggleExpand !== next`
  // branch fires, defeating the purpose.
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAddRoot = (type: string) => {
    const block = instantiateBlock(type)
    if (!block) return
    state.insertBlock(null, { kind: "root", index: 0 }, state.schema.blocks.length, block)
  }

  const rootIds = useMemo(() => state.schema.blocks.map(b => asBlockNode(b).id), [state.schema.blocks])

  if (state.schema.blocks.length === 0) {
    return (
      <EmptyDropZone
        depth={0}
        label="Drag a block from the palette to start, or pick one here"
        onAdd={handleAddRoot}
        testIdSuffix="root"
      />
    )
  }

  return (
    <ul className="space-y-1" data-testid="canvas-tree">
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        {state.schema.blocks.map((block, index) => (
          <BlockTreeItem
            key={asBlockNode(block).id}
            block={block}
            path={[{ kind: "root", index }]}
            depth={0}
            state={state}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            siblingCount={state.schema.blocks.length}
            siblingIndex={index}
          />
        ))}
      </SortableContext>
    </ul>
  )
}

function seedExpanded(schema: ReturnType<typeof useCanvasState>["schema"]): Set<string> {
  return collectContainerIds(schema)
}

function collectContainerIds(schema: ReturnType<typeof useCanvasState>["schema"]): Set<string> {
  const ids = new Set<string>()
  walkBlocks(schema, ({ block }) => {
    if (isContainer(block)) ids.add(asBlockNode(block).id)
  })
  return ids
}
