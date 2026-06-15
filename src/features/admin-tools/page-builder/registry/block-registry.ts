/**
 * Block registry — single source of truth for which block types exist
 * and how each renders. Implements spec §4.
 *
 * The class is a thin wrapper around a `Map<type, BlockDefinition>` plus
 * a small set of guards: each block must declare `wraps.componentPath`
 * (so traceability to an existing component is enforced at registration
 * time) and types are unique.
 *
 * Initialisation order (this file):
 *   1. Class + singleton are declared at the top.
 *   2. All built-in block definitions are imported from `./blocks/*`.
 *   3. Each definition is passed through `blockRegistry.register(...)`.
 *
 * Block files import `blockRegistry` only inside their `Render` functions
 * (never at module top-level). That keeps the registry-↔-block-files cycle
 * benign: by the time any `Render` runs, the registry is fully populated.
 */

import type { ComponentType } from "react"
import type { ZodType } from "zod"

export interface BlockDefinition<TProps = unknown> {
  /** Unique identifier matching the discriminator in `blockSchema`. */
  type: string
  category: "layout" | "data" | "form" | "action" | "content" | "custom"
  displayName: { en: string; ar: string }
  icon: string
  description: { en: string; ar: string }
  /** Zod schema for `TProps`. Used by the editor + by validation tests. */
  propsSchema: ZodType<TProps>
  /** Initial value when the block is first dropped on a canvas. */
  defaultProps: TProps
  /** Renderer (Phase 2: minimal; Phase 3 wraps it in the orchestrating PageRenderer). */
  Render: ComponentType<TProps>
  /** Optional custom editor; absent = the canvas falls back to the auto-generated form. */
  Editor?: ComponentType<{ value: TProps; onChange: (v: TProps) => void }>
  /** Optional palette preview. */
  preview?: ComponentType<{ props: TProps }>
  /**
   * Traceability — every block must wrap an existing component or a
   * documented HTML primitive. `register()` rejects blocks that omit this.
   */
  wraps: {
    componentPath: string
    componentName: string
  }
}

class BlockRegistry {
  private readonly blocks = new Map<string, BlockDefinition<unknown>>()

  register<T>(def: BlockDefinition<T>): void {
    if (this.blocks.has(def.type)) {
      throw new Error(`[BlockRegistry] block "${def.type}" already registered`)
    }
    if (!def.wraps?.componentPath) {
      throw new Error(`[BlockRegistry] block "${def.type}" must declare which existing component it wraps`)
    }
    this.blocks.set(def.type, def as BlockDefinition<unknown>)
  }

  get(type: string): BlockDefinition<unknown> | undefined {
    return this.blocks.get(type)
  }

  list(): BlockDefinition<unknown>[] {
    return [...this.blocks.values()]
  }

  byCategory(cat: BlockDefinition["category"]): BlockDefinition<unknown>[] {
    return this.list().filter(b => b.category === cat)
  }

  /** Test-only — clears the map so a test can rebuild from scratch. */
  reset(): void {
    this.blocks.clear()
  }
}

export const blockRegistry = new BlockRegistry()

// ─── Built-in block registration (Phase 2) ──────────────────────────────────
//
// Imports are hoisted, so by the time these `register(...)` calls run, the
// `blockRegistry` instance above has already been created. Block-file modules
// access `blockRegistry` ONLY inside their `Render` callbacks, so circular
// imports never observe an undefined instance.

import { headingBlockDefinition } from "./blocks/heading-block"
import { textBlockDefinition } from "./blocks/text-block"
import { dividerBlockDefinition } from "./blocks/divider-block"
import { spacerBlockDefinition } from "./blocks/spacer-block"
import { cardBlockDefinition } from "./blocks/card-block"
import { tabsBlockDefinition } from "./blocks/tabs-block"
import { accordionBlockDefinition } from "./blocks/accordion-block"
import { gridBlockDefinition } from "./blocks/grid-block"
import { tableBlockDefinition } from "./blocks/table-block"
import { formBlockDefinition } from "./blocks/form-block"
import { detailBlockDefinition } from "./blocks/detail-block"
import { kpiBlockDefinition } from "./blocks/kpi-block"
import { chartBlockDefinition } from "./blocks/chart-block"
import { alertBlockDefinition } from "./blocks/alert-block"
import { buttonBlockDefinition } from "./blocks/button-block"
import { mapBlockDefinition } from "./blocks/map-block"

blockRegistry.register(headingBlockDefinition)
blockRegistry.register(textBlockDefinition)
blockRegistry.register(dividerBlockDefinition)
blockRegistry.register(spacerBlockDefinition)
blockRegistry.register(cardBlockDefinition)
blockRegistry.register(tabsBlockDefinition)
blockRegistry.register(accordionBlockDefinition)
blockRegistry.register(gridBlockDefinition)
blockRegistry.register(tableBlockDefinition)
blockRegistry.register(formBlockDefinition)
blockRegistry.register(detailBlockDefinition)
blockRegistry.register(kpiBlockDefinition)
blockRegistry.register(chartBlockDefinition)
blockRegistry.register(alertBlockDefinition)
blockRegistry.register(buttonBlockDefinition)
blockRegistry.register(mapBlockDefinition)
