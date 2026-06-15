"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { Button, buttonVariants } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { buttonBlock } from "../../schema/block-schema"
import { InlineLocalizedText } from "../../canvas/inline/InlineLocalizedText"
import { usePageBuilderRender } from "../../renderer/PageBuilderRenderContext"
import type { BlockDefinition } from "../block-registry"

type ButtonBlockProps = z.infer<typeof buttonBlock>

/**
 * Button-level permission gate (per spec §10): the wrapped button
 * schema's optional `permission` is checked via
 * `usePermissionContext().isGranted(...)`. Admins bypass. The Button
 * itself still doesn't execute the action — that lives in
 * `renderer/ActionExecutor`.
 *
 * When the canvas's render context flips `isEditing=true`,
 * we swap the real `<Button>` (a DOM `<button>`) for a `<span>` styled
 * with the same `buttonVariants(...)` classes. That avoids the invalid
 * `<button><button>` nesting that would otherwise happen when the
 * inline-edit primitive renders its own clickable `<span role="button">`.
 * The runtime route still mounts the real Button.
 */
const ButtonBlockRender: ComponentType<ButtonBlockProps> = ({ id, button, hidden }) => {
  const { isGranted, isAdmin } = usePermissionContext()
  const { isEditing } = usePageBuilderRender()
  if (hidden || button.hidden) return null
  if (button.permission && !isAdmin && !isGranted(button.permission)) return null

  if (isEditing) {
    return (
      <span className={cn(buttonVariants({ variant: button.variant, size: button.size }))} role="presentation">
        <InlineLocalizedText
          as="span"
          blockId={id}
          fieldKey="button.label"
          value={button.label}
          placeholder="[Button label]"
        />
      </span>
    )
  }

  return (
    <Button variant={button.variant} size={button.size}>
      {button.label.en}
    </Button>
  )
}

export const buttonBlockDefinition: BlockDefinition<ButtonBlockProps> = {
  type: "button",
  category: "action",
  displayName: { en: "Button", ar: "زر" },
  icon: "MousePointerClick",
  description: { en: "A button that fires an action when clicked.", ar: "زر يُطلق إجراءً." },
  propsSchema: buttonBlock,
  defaultProps: buttonBlock.parse({
    id: "button-1",
    type: "button",
    button: {
      id: "btn-default",
      label: { en: "Click me", ar: "اضغط هنا" },
      position: "inline",
      action: { type: "navigate", href: "/" },
    },
  }),
  Render: ButtonBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/button.tsx",
    componentName: "Button",
  },
}
