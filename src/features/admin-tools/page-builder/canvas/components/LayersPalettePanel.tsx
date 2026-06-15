"use client"

/**
 * Tabs container for the canvas left rail. Holds two views:
 *   - **Layers** — the recursive `BlockTree` (navigate / select / move /
 *     delete blocks across the whole page schema)
 *   - **Palette** — the `BlockPalette` for adding new root-level blocks
 *
 * Two UX heuristics make the rail feel context-aware:
 *
 *   1. Default tab on mount: the panel picks `palette` when the schema
 *      is empty (admin needs to add their first block) and `layers`
 *      when there are existing blocks (admin probably opened the page
 *      to navigate / tweak).
 *   2. Auto-switch after add: the parent (`PageBuilderCanvas`) bumps
 *      `switchToLayersSignal` whenever a palette click results in an
 *      insert. The panel then flips to the Layers tab so the new
 *      block is immediately visible. The parent owns the counter so
 *      the signal is stable across rerenders.
 *
 * The panel keeps its own `activeTab` state — no localStorage / URL
 * sync, deliberately. Promoting persistence later would be a 2-line
 * change behind the same external surface.
 */

import { useEffect, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { walkBlocks } from "../tree"
import { useDragHandlers } from "../dnd/useDragHandlers"
import type { PageSchema } from "../../schema/page-schema"
import type { useCanvasState } from "../hooks/useCanvasState"
import { BlockPalette } from "../BlockPalette"
import { BlockTree } from "./BlockTree"
import { BlockTreeDndProvider } from "./BlockTreeDndProvider"

type RailTab = "layers" | "palette"

export interface LayersPalettePanelProps {
  state: ReturnType<typeof useCanvasState>
  onAddType: (type: string) => void
  /** Counter that increments after each palette-driven add — used to switch the tab. */
  switchToLayersSignal?: number
}

export function LayersPalettePanel({ state, onAddType, switchToLayersSignal = 0 }: LayersPalettePanelProps) {
  // Smart default — picked once at mount; subsequent schema changes do
  // not flip the tab (admin's manual choice always wins).
  const [activeTab, setActiveTab] = useState<RailTab>(() => (state.schema.blocks.length === 0 ? "palette" : "layers"))

  // Auto-switch to Layers whenever the parent bumps the signal. The
  // initial signal of 0 doesn't trigger; subsequent increments do.
  useEffect(() => {
    if (switchToLayersSignal > 0) setActiveTab("layers")
  }, [switchToLayersSignal])

  const totalBlocks = countAllBlocks(state.schema)
  const { activeBlock, handleDragStart, handleDragEnd, handleDragCancel } = useDragHandlers(state)

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as RailTab)} data-testid="layers-palette-panel">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="layers" data-testid="rail-tab-layers">
          <span>Layers</span>
          {totalBlocks > 0 && (
            <span
              className="ms-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium"
              data-testid="rail-tab-layers-count"
            >
              {totalBlocks}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="palette" data-testid="rail-tab-palette">
          Palette
        </TabsTrigger>
      </TabsList>

      <TabsContent value="layers" className="mt-4" data-testid="rail-content-layers">
        {state.schema.blocks.length === 0 ? (
          <EmptyLayersHint onSwitchToPalette={() => setActiveTab("palette")} />
        ) : (
          <BlockTreeDndProvider
            activeBlock={activeBlock}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <BlockTree state={state} />
          </BlockTreeDndProvider>
        )}
      </TabsContent>

      <TabsContent value="palette" className="mt-4" data-testid="rail-content-palette">
        <BlockPalette onAdd={onAddType} />
      </TabsContent>
    </Tabs>
  )
}

/**
 * Empty-state hint shown inside the Layers tab when the schema has no
 * blocks at all. The button is a courtesy shortcut — the same flow is
 * available by clicking the Palette tab directly.
 */
function EmptyLayersHint({ onSwitchToPalette }: { onSwitchToPalette: () => void }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed border-border p-6 text-center"
      data-testid="rail-empty-layers-hint"
    >
      <p className="mb-3 text-sm text-muted-foreground">No blocks yet. Add some from the palette to start building.</p>
      <Button variant="outline" size="sm" onClick={onSwitchToPalette} data-testid="rail-empty-switch-to-palette">
        Switch to Palette
      </Button>
    </div>
  )
}

function countAllBlocks(schema: PageSchema): number {
  let count = 0
  walkBlocks(schema, () => {
    count += 1
  })
  return count
}
