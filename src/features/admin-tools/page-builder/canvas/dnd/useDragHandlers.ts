"use client"

/**
 * Translation layer between dnd-kit drag events and the path-based
 * canvas state.
 *
 * Surface contract:
 *   - `activeId` / `activeBlock` — drives the `<DragOverlay>` ghost so
 *     the parent can render a floating preview while the underlying
 *     row stays at opacity 0.4 as a placeholder.
 *   - `handleDragStart` / `handleDragCancel` — set + clear the active
 *     id around the drag lifecycle.
 *   - Drop-on-slot support — a slot droppable carries
 *     `{ type: "slot", parentPath, slot }` data instead of an item path.
 *     Dropping into an empty slot or the gap area of a populated slot
 *     routes through this branch and inserts at index 0 (begin) of the
 *     target slot. Dropping over a sortable item still flows through
 *     the path-based item branch (the item wins over its parent slot
 *     by dnd-kit's deepest-collision default).
 *
 * `state.moveBlock` runs the structural validation either way (cycle,
 * form, slot/kind compatibility) so a rejected drop surfaces as a
 * notify.warning toast and leaves the schema untouched.
 */

import { useCallback, useMemo, useState } from "react"
import { type DragCancelEvent, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { findBlockById } from "../tree"
import type { BlockPath, PathSegment } from "../tree/types"
import type { BlockSchema } from "../../schema/block-schema"
import type { useCanvasState } from "../hooks/useCanvasState"

interface ItemDragData {
  path: BlockPath
}

interface SlotDragData {
  type: "slot"
  parentPath: BlockPath
  slot: PathSegment
}

type OverDataKind = "slot" | "item" | "unknown"

function classifyOverData(data: unknown): OverDataKind {
  if (!data || typeof data !== "object") return "unknown"
  if ((data as { type?: unknown }).type === "slot") return "slot"
  if (Array.isArray((data as { path?: unknown }).path)) return "item"
  return "unknown"
}

export function useDragHandlers(state: ReturnType<typeof useCanvasState>) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeBlock: BlockSchema | null = useMemo(
    () => (activeId ? (findBlockById(state.schema, activeId)?.block ?? null) : null),
    [state.schema, activeId],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveId(null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Clear immediately so the overlay disappears as the drop animation
      // begins; the actual schema mutation happens below.
      setActiveId(null)

      const { active, over } = event
      if (!over) return
      if (active.id === over.id) return

      const activeData = active.data.current as ItemDragData | undefined
      if (!activeData?.path) {
        // eslint-disable-next-line no-console
        console.debug("[dnd] drag-end missing active path", { active })
        return
      }
      const fromPath = activeData.path

      const overKind = classifyOverData(over.data.current)
      if (overKind === "slot") {
        const slotData = over.data.current as SlotDragData
        state.moveBlock(fromPath, slotData.parentPath.length === 0 ? null : slotData.parentPath, slotData.slot, 0)
        return
      }

      if (overKind !== "item") {
        // eslint-disable-next-line no-console
        console.debug("[dnd] drag-end missing over payload", { over })
        return
      }

      const toPath = (over.data.current as ItemDragData).path
      const targetParentPath = toPath.slice(0, -1)
      const targetSlot = toPath[toPath.length - 1]
      if (!targetSlot) return

      state.moveBlock(fromPath, targetParentPath.length === 0 ? null : targetParentPath, targetSlot, targetSlot.index)
    },
    [state],
  )

  return {
    activeId,
    activeBlock,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  }
}
