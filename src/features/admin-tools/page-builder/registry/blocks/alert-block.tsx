"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { Alert, AlertTitle, AlertDescription } from "@/ui/design-system/primitives/alert"
import { alertBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type AlertBlockProps = z.infer<typeof alertBlock>

const SEVERITY_TO_VARIANT = {
  info: "info",
  success: "success",
  warning: "warning",
  destructive: "destructive",
} as const

const AlertBlockRender: ComponentType<AlertBlockProps> = ({ severity, title, message, hidden }) => {
  if (hidden) return null
  return (
    <Alert variant={SEVERITY_TO_VARIANT[severity]}>
      <AlertTitle>{title.en}</AlertTitle>
      {message && <AlertDescription>{message.en}</AlertDescription>}
    </Alert>
  )
}

export const alertBlockDefinition: BlockDefinition<AlertBlockProps> = {
  type: "alert",
  category: "data",
  displayName: { en: "Alert", ar: "تنبيه" },
  icon: "AlertTriangle",
  description: { en: "Inline alert (info / success / warning / destructive).", ar: "تنبيه ضمن الصفحة." },
  propsSchema: alertBlock,
  defaultProps: alertBlock.parse({
    id: "alert-1",
    type: "alert",
    severity: "info",
    title: { en: "Notice", ar: "ملاحظة" },
  }),
  Render: AlertBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/alert.tsx",
    componentName: "Alert / AlertTitle / AlertDescription",
  },
}
