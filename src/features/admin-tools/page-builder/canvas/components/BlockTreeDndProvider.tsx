"use client"

/**
 * DnD context wrapper for the canvas Layers tab.
 *
 * Sensor configuration:
 *   - `MouseSensor` ONLY — Phase 2B is desktop-only by spec, so we
 *     deliberately omit the touch sensor. Touch users can still pick
 *     blocks through the palette / Move ↑↓ / Move-to submenu.
 *   - 5 px activation distance — prevents an accidental drag when the
 *     admin clicks to select a block.
 *
 * Auto-scroll is enabled (DndContext default) so dragging near the top
 * or bottom of the rail's `overflow-y-auto` aside scrolls automatically.
 *
 * Also renders a `<DragOverlay>` showing a ghost preview of
 * the active block. The active block is computed by `useDragHandlers`
 * (in the parent) and forwarded here as a prop — keeping all dnd UI
 * in one boundary so the parent only needs to wire callbacks. The drop
 * animation uses a brief 150ms cubic-bezier flick so the overlay
 * settles into its final position with a touch of bounce, rather than
 * snapping flat.
 */

import { type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { DragOverlayPreview } from "./DragOverlayPreview"
import type { BlockSchema } from "../../schema/block-schema"

/**
 * Screen-reader announcements consumed by dnd-kit's Announcer (rendered
 * automatically as a visually-hidden aria-live region). The active /
 * over ids are block ids in our system, which are kebab-case and
 * speakable; we deliberately don't try to look up the prettier
 * `displayName` here so the announcer stays pure (no schema reads from
 * inside the DndContext).
 */
const dndAnnouncements: Announcements = {
  onDragStart({ active }) {
    return `Picked up draggable item ${String(active.id)}.`
  },
  onDragOver({ active, over }) {
    if (over) return `Draggable item ${String(active.id)} is over droppable area ${String(over.id)}.`
    return `Draggable item ${String(active.id)} is no longer over a droppable area.`
  },
  onDragEnd({ active, over }) {
    if (over) return `Draggable item ${String(active.id)} was dropped over droppable area ${String(over.id)}.`
    return `Draggable item ${String(active.id)} was dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging was cancelled. Draggable item ${String(active.id)} was returned.`
  },
}

export interface BlockTreeDndProviderProps {
  children: ReactNode
  activeBlock?: BlockSchema | null
  onDragStart?: (event: DragStartEvent) => void
  onDragOver?: (event: DragOverEvent) => void
  onDragEnd?: (event: DragEndEvent) => void
  onDragCancel?: (event: DragCancelEvent) => void
}

export function BlockTreeDndProvider({
  children,
  activeBlock,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: BlockTreeDndProviderProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements: dndAnnouncements }}
      autoScroll
    >
      <div data-testid="block-tree-dnd-provider">{children}</div>
      <DragOverlay
        dropAnimation={{
          duration: 150,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
      >
        {activeBlock ? <DragOverlayPreview block={activeBlock} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
