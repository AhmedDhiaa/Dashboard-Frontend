"use client"

/**
 * Per-block "⋮" actions dropdown. Three actions plus a nested submenu:
 *   - Duplicate                  — `state.duplicateBlockAt(path)`
 *   - Move to ▶ <target list>    — `state.moveBlock(path, ...target)`
 *   - Delete                     — `state.removeBlockAt(path)`
 *
 * The Move-to list is sourced from `getDropTargets(schema, path)` so
 * each entry already carries the right parentPath/slot/index plus a
 * human label ("Top of page", "Inside Card body", "Inside Login tab",
 * …). Validity is enforced inside getDropTargets — we don't filter
 * here.
 */

import { Copy, MoreVertical, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { asBlockNode, getDropTargets, type BlockPath } from "../tree"
import type { BlockSchema } from "../../schema/block-schema"
import type { useCanvasState } from "../hooks/useCanvasState"

export interface BlockActionsMenuProps {
  block: BlockSchema
  path: BlockPath
  state: ReturnType<typeof useCanvasState>
}

export function BlockActionsMenu({ block, path, state }: BlockActionsMenuProps) {
  const blockId = asBlockNode(block).id
  const dropTargets = getDropTargets(state.schema, path)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="iconSm" variant="ghost" data-testid={`tree-actions-${blockId}`} aria-label="Block actions">
          <MoreVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => state.duplicateBlockAt(path)} data-testid={`tree-action-${blockId}-duplicate`}>
          <Copy className="h-3 w-3 me-2" />
          Duplicate
        </DropdownMenuItem>

        {dropTargets.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid={`tree-action-${blockId}-move-to`}>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {dropTargets.map((target, i) => (
                <DropdownMenuItem
                  key={`${target.label}-${i}`}
                  onClick={() => state.moveBlock(path, target.parentPath, target.slot, target.index)}
                  data-testid={`tree-action-${blockId}-move-target-${i}`}
                >
                  {target.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => state.removeBlockAt(path)}
          className="text-destructive focus:text-destructive"
          data-testid={`tree-action-${blockId}-delete`}
        >
          <Trash2 className="h-3 w-3 me-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
