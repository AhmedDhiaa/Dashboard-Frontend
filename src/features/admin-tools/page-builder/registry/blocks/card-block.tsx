"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/design-system/primitives/card"
import { cardBlock } from "../../schema/block-schema"
import { InlineLocalizedText } from "../../canvas/inline/InlineLocalizedText"
import { usePageBuilderRender } from "../../renderer/PageBuilderRenderContext"
import type { BlockDefinition } from "../block-registry"

type CardBlockProps = z.infer<typeof cardBlock> & { children?: ReactNode }

/**
 * Phase 2 wraps Card structurally and accepts pre-rendered children via the
 * React `children` prop. The orchestrating `BlockRenderer` (Phase 3) walks
 * the schema's `blocks: BlockSchema[]` and supplies the JSX. Keeping the
 * recursion out of the Render here avoids a load-order cycle with the block
 * registry (which imports every block file at module init).
 *
 * `title` is optional in the schema. At runtime
 * (`isEditing=false`) the CardHeader stays conditional on `title` so an
 * untitled card has no empty header. In edit mode the header is always
 * shown with a `"+ Add title"` placeholder so admins can introduce a
 * title without leaving the live preview.
 */
const CardBlockRender: ComponentType<CardBlockProps> = ({ id, title, children, hidden }) => {
  const { isEditing } = usePageBuilderRender()
  if (hidden) return null
  const showHeader = isEditing || Boolean(title)
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle>
            <InlineLocalizedText
              as="span"
              blockId={id}
              fieldKey="title"
              value={title ?? { en: "", ar: "" }}
              placeholder="+ Add title"
            />
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export const cardBlockDefinition: BlockDefinition<CardBlockProps> = {
  type: "card",
  category: "layout",
  displayName: { en: "Card", ar: "بطاقة" },
  icon: "Square",
  description: { en: "A card container that groups other blocks.", ar: "حاوية بطاقة تجمع كتلاً أخرى." },
  propsSchema: cardBlock,
  defaultProps: cardBlock.parse({
    id: "card-1",
    type: "card",
    blocks: [],
  }),
  Render: CardBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/card.tsx",
    componentName: "Card / CardHeader / CardContent",
  },
}
