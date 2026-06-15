"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { Separator } from "@/ui/design-system/primitives/separator"
import { dividerBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type DividerBlockProps = z.infer<typeof dividerBlock>

const DividerBlockRender: ComponentType<DividerBlockProps> = ({ hidden }) => {
  if (hidden) return null
  return <Separator className="my-2" />
}

export const dividerBlockDefinition: BlockDefinition<DividerBlockProps> = {
  type: "divider",
  category: "content",
  displayName: { en: "Divider", ar: "فاصل" },
  icon: "Minus",
  description: { en: "A horizontal separator line.", ar: "فاصل أفقي." },
  propsSchema: dividerBlock,
  defaultProps: dividerBlock.parse({ id: "divider-1", type: "divider" }),
  Render: DividerBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/separator.tsx",
    componentName: "Separator",
  },
}
