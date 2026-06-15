import { z } from "zod"
import type { FormFieldConfig } from "@/core/entities/types"

export interface SchemaFormRendererProps {
  schema: z.ZodObject<z.ZodRawShape>
  fieldConfig?: Record<string, FormFieldConfig>
  excludeFields?: string[]
  fieldOrder?: string[]
  className?: string | null
  /** If true, only fields in fieldOrder are rendered (no automatic appending) */
  strict?: boolean
}

export interface ExtractedField {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface SubRendererProps {
  field: ExtractedField
  config: FormFieldConfig
  label: string
  placeholder?: string
  t?: (key: string) => string
}
