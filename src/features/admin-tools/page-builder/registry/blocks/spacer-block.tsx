"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { spacerBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type SpacerBlockProps = z.infer<typeof spacerBlock>

const SIZE_CLASSES: Record<SpacerBlockProps["size"], string> = {
  sm: "h-2",
  md: "h-4",
  lg: "h-8",
}

const SpacerBlockRender: ComponentType<SpacerBlockProps> = ({ size, hidden }) => {
  if (hidden) return null
  return <div className={SIZE_CLASSES[size]} aria-hidden="true" />
}

export const spacerBlockDefinition: BlockDefinition<SpacerBlockProps> = {
  type: "spacer",
  category: "content",
  displayName: { en: "Spacer", ar: "مسافة" },
  icon: "MoveVertical",
  description: { en: "Empty vertical gap (sm / md / lg).", ar: "مسافة عمودية فارغة." },
  propsSchema: spacerBlock,
  defaultProps: spacerBlock.parse({ id: "spacer-1", type: "spacer" }),
  Render: SpacerBlockRender,
  wraps: {
    componentPath: "(builtin) HTML <div>",
    componentName: "div",
  },
}
