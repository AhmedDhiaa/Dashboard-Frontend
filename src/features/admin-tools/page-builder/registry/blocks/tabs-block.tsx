"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/design-system/primitives/tabs"
import { tabsBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

/**
 * Phase 2 renders the Tabs primitive's structure (triggers + empty panels).
 * Per-tab children come in via the optional `tabContents` map keyed by tab
 * id; the orchestrating `BlockRenderer` (Phase 3) populates it by recursing
 * each tab's `blocks: BlockSchema[]`. Keeping the recursion in PageRenderer
 * avoids a load-order cycle with the block registry.
 */
type TabsBlockProps = z.infer<typeof tabsBlock> & {
  tabContents?: Record<string, ReactNode>
}

const TabsBlockRender: ComponentType<TabsBlockProps> = ({ tabs, tabContents, hidden }) => {
  if (hidden || tabs.length === 0) return null
  const firstId = tabs[0]!.id
  return (
    <Tabs defaultValue={firstId}>
      <TabsList>
        {tabs.map(tab => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label.en}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(tab => (
        <TabsContent key={tab.id} value={tab.id}>
          {tabContents?.[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export const tabsBlockDefinition: BlockDefinition<TabsBlockProps> = {
  type: "tabs",
  category: "layout",
  displayName: { en: "Tabs", ar: "علامات تبويب" },
  icon: "Folder",
  description: { en: "Tabbed sections, each containing nested blocks.", ar: "أقسام تبويبية." },
  propsSchema: tabsBlock,
  defaultProps: tabsBlock.parse({
    id: "tabs-1",
    type: "tabs",
    tabs: [{ id: "tab-1", label: { en: "Tab 1", ar: "تبويب 1" }, blocks: [] }],
  }),
  Render: TabsBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/tabs.tsx",
    componentName: "Tabs / TabsList / TabsTrigger / TabsContent",
  },
}
