/**
 * Tree-walk types for the Page Builder canvas.
 *
 * The Page Builder schema is a recursive composition of `BlockSchema` —
 * cards, grids, tabs and accordions can hold further blocks. The canvas
 * needs to navigate that tree, mutate it immutably, and validate drops.
 * That requires a stable, addressable identity for every node — a
 * `BlockPath` — which these types define.
 *
 * `BlockPath` is a list of `PathSegment` entries. The first segment is
 * always `{kind:"root", index}` pointing at `schema.blocks[index]`. Each
 * subsequent segment describes how to descend INTO the previous block:
 *
 *   - `{kind:"blocks", index}`             → card.blocks[i] / grid.blocks[i]
 *   - `{kind:"tab", tabId, index}`         → tabs.tabs[find tabId].blocks[i]
 *   - `{kind:"item", itemId, index}`       → accordion.items[find itemId].blocks[i]
 *   - `{kind:"action-blocks", index}`      → button.button.action.blocks[i]
 *
 * The `index` field encodes WHICH child within that slot. When a segment
 * is used as a *slot identifier* (rather than to address a specific child)
 * the index is unused; callers ignore it for slot identity, looking only
 * at `kind` plus `tabId`/`itemId` for tabs/accordion respectively.
 */

import type { BlockSchema } from "../../schema/block-schema"

// ─── Block type vocabulary ─────────────────────────────────────────────────

/**
 * Hard-coded enum of every block `type` the schema admits. We re-state it
 * here because `BlockSchema` is annotated `z.ZodType` to break recursive
 * type inference, which collapses `BlockSchema["type"]` to `unknown`.
 */
export type BlockType =
  | "heading"
  | "text"
  | "divider"
  | "spacer"
  | "card"
  | "tabs"
  | "accordion"
  | "grid"
  | "table"
  | "form"
  | "detail"
  | "kpi"
  | "chart"
  | "alert"
  | "button"
  | "map"
  | "custom"

/** Block kinds whose schema carries a `blocks[]` slot the canvas can edit. */
export type ContainerKind = "card" | "grid" | "tabs" | "accordion"

// ─── Path segments ─────────────────────────────────────────────────────────

export type PathSegment =
  | { kind: "root"; index: number }
  | { kind: "blocks"; index: number }
  | { kind: "tab"; tabId: string; index: number }
  | { kind: "item"; itemId: string; index: number }
  | { kind: "action-blocks"; index: number }

export type BlockPath = PathSegment[]

/**
 * Result of `findBlockById`. `parent` and `parentSlot` are both null for
 * root-level blocks — the path's lone `{kind:"root"}` segment is the
 * "navigation" entry, not a slot identity.
 */
export interface PathLookupResult {
  block: BlockSchema
  path: BlockPath
  parent: BlockSchema | null
  parentSlot: PathSegment | null
}

// ─── Internal: structural narrowing of the loose `BlockSchema` ─────────────
//
// BlockSchema is typed as `unknown` (consequence of the `z.ZodType`
// annotation on the discriminated union — needed to break circular type
// inference between block-schema and action-schema). Operating on the
// tree requires reading the structural fields, so we cast to this
// hand-rolled `BlockNode` shape at the boundaries.

interface TabBranch {
  id: string
  label: { en: string; ar: string }
  icon?: string
  permission?: string
  blocks: BlockSchema[]
}

interface ItemBranch {
  id: string
  title: { en: string; ar: string }
  icon?: string
  blocks: BlockSchema[]
}

interface ActionRef {
  type: string
  title?: { en: string; ar: string }
  side?: "start" | "end" | "top" | "bottom"
  blocks?: BlockSchema[]
}

interface ButtonRef {
  id?: string
  label?: { en: string; ar: string }
  action?: ActionRef
}

export interface BlockNode {
  id: string
  type: BlockType
  hidden?: boolean
  // card / grid
  blocks?: BlockSchema[]
  // tabs
  tabs?: TabBranch[]
  // accordion
  items?: ItemBranch[]
  // button
  button?: ButtonRef
  // grid
  columns?: 1 | 2 | 3 | 4
  // tabs.multiple, accordion.multiple
  multiple?: boolean
  // Allow other arbitrary keys without losing the cast — every concrete
  // block carries fields beyond what we touch here.
  [key: string]: unknown
}

/**
 * Cast helper. The double-cast (`unknown` then `BlockNode`) matches the
 * pattern used elsewhere (BlockRenderer.tsx, useCanvasState.ts) — it
 * acknowledges that the discriminated union's runtime shape is wider
 * than what the loose `BlockSchema` type tells the compiler.
 */
export function asBlockNode(block: BlockSchema): BlockNode {
  return block as unknown as BlockNode
}
