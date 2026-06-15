"use client"

/**
 * Block palette — the left-rail catalogue of every registered block,
 * grouped by `BlockDefinition.category`.
 *
 * Drag interaction uses the native HTML5 dataTransfer API (no dnd-kit /
 * react-dnd dependency, per Phase 4 constraint). The dragged payload is
 * the block `type` string — the canvas's drop handler resolves the
 * default props from `blockRegistry.get(type).defaultProps` and pushes
 * a clone into the schema.
 */

import { useMemo } from "react"
import { blockRegistry, type BlockDefinition } from "../registry/block-registry"

const CATEGORY_LABEL: Record<BlockDefinition["category"], string> = {
  content: "Content",
  layout: "Layout",
  data: "Data",
  form: "Form",
  action: "Action",
  custom: "Custom",
}

export const PAGE_BUILDER_DRAG_TYPE = "application/page-builder-block-type"

export interface BlockPaletteProps {
  /** Optional click-to-add fallback when drag isn't available. */
  onAdd?: (type: string) => void
}

export function BlockPalette({ onAdd }: BlockPaletteProps) {
  const grouped = useMemo(() => {
    const groups = new Map<BlockDefinition["category"], BlockDefinition[]>()
    for (const def of blockRegistry.list()) {
      const list = groups.get(def.category) ?? []
      list.push(def)
      groups.set(def.category, list)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [])

  return (
    <div className="space-y-4" data-testid="block-palette">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Blocks</h2>
      {grouped.map(([category, list]) => (
        <section key={category} aria-labelledby={`palette-${category}`}>
          <h3
            id={`palette-${category}`}
            className="text-xs font-semibold text-foreground/70 mb-2 uppercase tracking-wider"
          >
            {CATEGORY_LABEL[category]}
          </h3>
          <ul className="space-y-1">
            {list.map(def => (
              <li key={def.type}>
                <button
                  type="button"
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData(PAGE_BUILDER_DRAG_TYPE, def.type)
                    e.dataTransfer.effectAllowed = "copy"
                  }}
                  onClick={() => onAdd?.(def.type)}
                  className="w-full rounded border border-border bg-card px-3 py-2 text-start text-sm hover:bg-accent hover:cursor-grab active:cursor-grabbing"
                  data-testid={`palette-block-${def.type}`}
                  data-block-type={def.type}
                >
                  <span className="font-medium">{def.displayName.en}</span>
                  <span className="block text-xs text-muted-foreground">{def.description.en}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
