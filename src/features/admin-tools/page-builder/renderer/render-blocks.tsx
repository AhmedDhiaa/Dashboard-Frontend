"use client"

/**
 * Tiny adapter that turns a `BlockSchema[]` into a single ReactNode by
 * dispatching each child through `BlockRenderer`. Lives in its own file
 * so `ActionExecutor.ts` can stay JSX-free (and therefore `.ts`) — the
 * dialog/drawer cases just pass `renderBlocks(action.blocks)` along to
 * the overlay host.
 */

import { Fragment, type ReactNode } from "react"
import type { BlockSchema } from "../schema/block-schema"
import { BlockRenderer } from "./BlockRenderer"

export function renderBlocks(blocks: BlockSchema[]): ReactNode {
  return (
    <Fragment>
      {blocks.map(b => (
        <BlockRenderer key={(b as { id: string }).id} block={b} />
      ))}
    </Fragment>
  )
}
