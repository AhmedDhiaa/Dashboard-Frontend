"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { accordionBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

/**
 * Spec §4 marks accordion as "new — extend if missing". The codebase has no
 * Accordion primitive today, so this block uses the native HTML
 * <details>/<summary> element. Per-item children come in via `itemContents`
 * (keyed by item id); the orchestrating `BlockRenderer` (Phase 3) supplies
 * them by recursing each item's `blocks: BlockSchema[]`.
 */
type AccordionBlockProps = z.infer<typeof accordionBlock> & {
  itemContents?: Record<string, ReactNode>
}

const AccordionBlockRender: ComponentType<AccordionBlockProps> = ({ items, itemContents, hidden }) => {
  if (hidden) return null
  return (
    <div className="space-y-2">
      {items.map(item => (
        <details
          key={item.id}
          className="rounded-md border border-border bg-card p-3 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="cursor-pointer select-none text-sm font-medium">{item.title.en}</summary>
          <div className="mt-3">{itemContents?.[item.id]}</div>
        </details>
      ))}
    </div>
  )
}

export const accordionBlockDefinition: BlockDefinition<AccordionBlockProps> = {
  type: "accordion",
  category: "layout",
  displayName: { en: "Accordion", ar: "أكورديون" },
  icon: "ListCollapse",
  description: { en: "Stacked collapsible items.", ar: "عناصر قابلة للطيّ بشكل مكدّس." },
  propsSchema: accordionBlock,
  defaultProps: accordionBlock.parse({
    id: "accordion-1",
    type: "accordion",
    items: [{ id: "item-1", title: { en: "Item 1", ar: "عنصر 1" }, blocks: [] }],
  }),
  Render: AccordionBlockRender,
  wraps: {
    componentPath: "(builtin) HTML <details>/<summary>",
    componentName: "details/summary",
  },
}
