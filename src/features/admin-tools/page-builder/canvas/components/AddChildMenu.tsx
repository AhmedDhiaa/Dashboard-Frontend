"use client"

/**
 * Mini block-palette: a "+ Add child" button that opens a dropdown of
 * every registered block type, grouped flat for now (categorisation
 * lives in the main palette). Used inside container slots and inside
 * empty-slot placeholders.
 */

import { Plus } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { blockRegistry, type BlockDefinition } from "../../registry/block-registry"

export interface AddChildMenuProps {
  depth: number
  onSelect: (blockType: string) => void
  /** Optional predicate to restrict which block types appear (e.g. exclude form inside a form). */
  filter?: (def: BlockDefinition<unknown>) => boolean
  /** Visual label override; defaults to "Add child". */
  label?: string
  /** Test id suffix override; defaults to a stable string. */
  testIdSuffix?: string
}

export function AddChildMenu({
  depth,
  onSelect,
  filter,
  label = "Add child",
  testIdSuffix = "default",
}: AddChildMenuProps) {
  const list = blockRegistry.list().filter(filter ?? (() => true))
  return (
    <div style={{ paddingInlineStart: `${depth * 1.25}rem` }} data-testid={`tree-add-child-${testIdSuffix}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start gap-1 text-xs text-muted-foreground border border-dashed border-border/40"
            data-testid={`tree-add-child-trigger-${testIdSuffix}`}
          >
            <Plus className="h-3 w-3" />
            <span>{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {list.map(def => (
            <DropdownMenuItem
              key={def.type}
              onClick={() => onSelect(def.type)}
              data-testid={`tree-add-child-item-${def.type}`}
            >
              <span>{def.displayName.en}</span>
              <span className="ms-auto ps-3 text-xs text-muted-foreground">{def.type}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
