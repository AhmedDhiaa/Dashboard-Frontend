"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { gridBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type GridBlockProps = z.infer<typeof gridBlock> & { children?: ReactNode }

const COLUMN_CLASSES = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
} as const

/**
 * Phase 2 renders the Tailwind grid container; the orchestrating
 * `BlockRenderer` (Phase 3) supplies pre-rendered cell content via the
 * standard React `children` prop. Keeps grid-block free of any block
 * registry import (which would create a load-order cycle).
 */
const GridBlockRender: ComponentType<GridBlockProps> = ({ columns, children, hidden }) => {
  if (hidden) return null
  return <div className={`grid w-full gap-4 ${COLUMN_CLASSES[columns]}`}>{children}</div>
}

export const gridBlockDefinition: BlockDefinition<GridBlockProps> = {
  type: "grid",
  category: "layout",
  displayName: { en: "Grid", ar: "شبكة" },
  icon: "LayoutGrid",
  description: { en: "Tailwind-grid layout (1-4 columns) of nested blocks.", ar: "تخطيط شبكة." },
  propsSchema: gridBlock,
  defaultProps: gridBlock.parse({
    id: "grid-1",
    type: "grid",
    columns: 2,
    blocks: [],
  }),
  Render: GridBlockRender,
  wraps: {
    componentPath: "(builtin) Tailwind grid utilities",
    componentName: "div (grid)",
  },
}
