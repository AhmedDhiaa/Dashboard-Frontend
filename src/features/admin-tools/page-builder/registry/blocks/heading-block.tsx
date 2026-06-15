"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { headingBlock } from "../../schema/block-schema"
import { InlineLocalizedText } from "../../canvas/inline/InlineLocalizedText"
import type { BlockDefinition } from "../block-registry"

type HeadingBlockProps = z.infer<typeof headingBlock>

const HeadingBlockRender: ComponentType<HeadingBlockProps> = ({ id, text, level, hidden }) => {
  if (hidden) return null
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4"
  const sizeClass = level === 1 ? "text-4xl" : level === 2 ? "text-2xl" : level === 3 ? "text-xl" : "text-lg"
  return (
    <InlineLocalizedText
      as={Tag}
      blockId={id}
      fieldKey="text"
      value={text}
      className={`${sizeClass} font-semibold tracking-tight`}
      placeholder={`[Heading ${level}]`}
    />
  )
}

export const headingBlockDefinition: BlockDefinition<HeadingBlockProps> = {
  type: "heading",
  category: "content",
  displayName: { en: "Heading", ar: "عنوان" },
  icon: "Heading",
  description: { en: "A semantic heading (h1-h4).", ar: "عنوان دلالي (h1-h4)." },
  propsSchema: headingBlock,
  defaultProps: headingBlock.parse({
    id: "heading-1",
    type: "heading",
    text: { en: "Heading", ar: "عنوان" },
  }),
  Render: HeadingBlockRender,
  wraps: {
    componentPath: "(builtin) HTML <h1>-<h4>",
    componentName: "h1/h2/h3/h4",
  },
}
