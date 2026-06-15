"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { textBlock } from "../../schema/block-schema"
import { InlineLocalizedText } from "../../canvas/inline/InlineLocalizedText"
import type { BlockDefinition } from "../block-registry"

type TextBlockProps = z.infer<typeof textBlock>

const VARIANT_CLASSES: Record<TextBlockProps["variant"], string> = {
  body: "text-base text-foreground",
  muted: "text-sm text-muted-foreground",
  lead: "text-lg text-foreground/90 leading-relaxed",
}

const TextBlockRender: ComponentType<TextBlockProps> = ({ id, text, variant, hidden }) => {
  if (hidden) return null
  return (
    <InlineLocalizedText
      as="p"
      blockId={id}
      fieldKey="text"
      value={text}
      className={VARIANT_CLASSES[variant]}
      multiline
      placeholder="[Text]"
    />
  )
}

export const textBlockDefinition: BlockDefinition<TextBlockProps> = {
  type: "text",
  category: "content",
  displayName: { en: "Text", ar: "نص" },
  icon: "Type",
  description: { en: "A paragraph of body, muted, or lead text.", ar: "فقرة نصّية." },
  propsSchema: textBlock,
  defaultProps: textBlock.parse({
    id: "text-1",
    type: "text",
    text: { en: "Lorem ipsum dolor sit amet.", ar: "نص تجريبي." },
  }),
  Render: TextBlockRender,
  wraps: {
    componentPath: "(builtin) HTML <p>",
    componentName: "p",
  },
}
