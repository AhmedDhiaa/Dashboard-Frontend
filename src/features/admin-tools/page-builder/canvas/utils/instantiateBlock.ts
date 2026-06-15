/**
 * Build a fresh block instance from a registered type. Used by the
 * canvas (palette + BlockTree) whenever the admin asks to add a block
 * — the registry holds `defaultProps` (validated by the propsSchema)
 * and we patch a unique id over the cloned defaults.
 */

import { blockRegistry } from "../../registry/block-registry"
import { generateBlockId } from "../tree"
import type { BlockSchema } from "../../schema/block-schema"

export function instantiateBlock(type: string): BlockSchema | null {
  const def = blockRegistry.get(type)
  if (!def) return null
  // Deep clone so two simultaneous palette clicks don't share a tabs/items
  // sub-array that would link the resulting blocks together.
  const clone = JSON.parse(JSON.stringify(def.defaultProps)) as { id: string; type: string }
  clone.id = generateBlockId(type)
  return clone as unknown as BlockSchema
}
