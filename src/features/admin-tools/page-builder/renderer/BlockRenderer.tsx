"use client"

/**
 * Recursive block renderer.
 *
 * Looks up `block.type` in the `blockRegistry` and instantiates that block's
 * `Render`. For layout blocks (`card`, `tabs`, `accordion`, `grid`) it
 * pre-computes the children by recursing each nested block — that keeps the
 * registry-↔-block-files cycle benign (no block file imports the registry).
 *
 * Layout-block adaptation:
 *   - `card`, `grid`        : pass the recursed children via React `children`.
 *   - `tabs`                : build a `tabContents: Record<id, ReactNode>` map.
 *   - `accordion`           : build an `itemContents: Record<id, ReactNode>` map.
 *
 * Unknown / hidden / permission-denied blocks render `null` and report
 * the unknown-type case via `errorReporter` so misconfigurations show up
 * in the observability backend instead of failing silently.
 */

import { Fragment, useMemo, type ReactNode } from "react"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { errorReporter } from "@/infra/observability/error-reporter"
import { blockRegistry } from "../registry/block-registry"
import type { BlockSchema } from "../schema/block-schema"

interface BlockNode {
  id: string
  type: string
  hidden?: boolean
  permission?: string
}

export interface BlockRendererProps {
  block: BlockSchema
}

export function BlockRenderer({ block }: BlockRendererProps) {
  const node = block as unknown as BlockNode
  const { isGranted, isAdmin } = usePermissionContext()

  // Permission gate (block-level, per spec §10).
  const allowed = isAdmin || !node.permission || isGranted(node.permission)

  // Layout-block child computation.
  const computedChildren = useMemo(() => computeLayoutChildren(block), [block])

  if (node.hidden || !allowed) return null

  const def = blockRegistry.get(node.type)
  if (!def) {
    errorReporter.captureException(new Error(`Unknown block type "${node.type}"`), {
      tags: { source: "page-builder.block-renderer", blockId: node.id },
    })
    return null
  }

  const Render = def.Render as (props: Record<string, unknown>) => ReactNode

  switch (node.type) {
    case "card":
    case "grid":
      // Pass recursed children via React children.
      return <Render {...(block as object)}>{computedChildren as ReactNode}</Render>

    case "tabs":
      return <Render {...(block as object)} tabContents={computedChildren as Record<string, ReactNode>} />

    case "accordion":
      return <Render {...(block as object)} itemContents={computedChildren as Record<string, ReactNode>} />

    default:
      return <Render {...(block as object)} />
  }
}

/**
 * Resolve nested `blocks: BlockSchema[]` into pre-rendered ReactNodes for
 * layout block types. Returns `null` for non-layout blocks.
 */
function computeLayoutChildren(block: BlockSchema): ReactNode | Record<string, ReactNode> | null {
  const node = block as unknown as { type: string; blocks?: BlockSchema[]; tabs?: TabBranch[]; items?: ItemBranch[] }

  if (node.type === "card" || node.type === "grid") {
    if (!node.blocks) return null
    return (
      <Fragment>
        {node.blocks.map(b => (
          <BlockRenderer key={(b as { id: string }).id} block={b} />
        ))}
      </Fragment>
    )
  }

  if (node.type === "tabs") {
    if (!node.tabs) return null
    return Object.fromEntries(
      node.tabs.map(tab => [
        tab.id,
        <Fragment key={tab.id}>
          {tab.blocks.map(b => (
            <BlockRenderer key={(b as { id: string }).id} block={b} />
          ))}
        </Fragment>,
      ]),
    )
  }

  if (node.type === "accordion") {
    if (!node.items) return null
    return Object.fromEntries(
      node.items.map(item => [
        item.id,
        <Fragment key={item.id}>
          {item.blocks.map(b => (
            <BlockRenderer key={(b as { id: string }).id} block={b} />
          ))}
        </Fragment>,
      ]),
    )
  }

  return null
}

interface TabBranch {
  id: string
  blocks: BlockSchema[]
}

interface ItemBranch {
  id: string
  blocks: BlockSchema[]
}
