import { z } from "zod"
import { cn } from "@/shared/utils"
import type { FormFieldConfig } from "@/core/entities/types"
import type { ExtractedField } from "./SchemaFormRenderer.types"
import {
  RenderTextArea,
  RenderNumberField,
  RenderBooleanField,
  RenderAutocompleteField,
  RenderSelectField,
  RenderEnumField,
  RenderDefaultField,
  RenderDateField,
  RenderTagsField,
} from "./FormFields/SchemaSubRenderers"

export const FieldRenderer = ({
  field,
  config,
  t,
}: {
  field: ExtractedField
  config: FormFieldConfig
  t: (key: string) => string
}) => {
  const getLabel = () => {
    if (config.labelKey) return t(config.labelKey)
    if (config.label) return config.label
    try {
      return t(`common.fields.${field.name}`)
    } catch {
      try {
        return t(`pages.${field.name}`)
      } catch {
        return field.name.charAt(0).toUpperCase() + field.name.slice(1)
      }
    }
  }

  const getPlaceholder = () =>
    config.placeholder || t(`common.placeholders.enter_${field.name}`) || t(`common.placeholders.enter_value`)

  if (config.hidden) return null

  const label = getLabel()
  const effectiveType = (config.type || field.type) as string
  const placeholder = effectiveType !== "boolean" ? getPlaceholder() : undefined

  const colSpanClass = config.colSpan ? (config.colSpan === 1 ? "col-span-1" : `col-span-${config.colSpan}`) : ""

  const renderContent = () => {
    if (config.customRender) {
      return config.customRender(field.name, label, field.required)
    }

    switch (effectiveType) {
      case "textarea":
        return <RenderTextArea field={field} config={config} label={label} placeholder={placeholder} />
      case "number":
        return <RenderNumberField field={field} config={config} label={label} placeholder={placeholder} />
      case "boolean":
        return <RenderBooleanField field={field} config={config} label={label} />
      case "autocomplete":
      case "entity":
        return <RenderAutocompleteField field={field} config={config} label={label} placeholder={placeholder} t={t} />
      case "select":
        return <RenderSelectField field={field} config={config} label={label} placeholder={placeholder} />
      case "enum":
        return <RenderEnumField field={field} config={config} label={label} placeholder={placeholder} />
      case "date":
      case "datetime":
        return <RenderDateField field={field} config={config} label={label} placeholder={placeholder} />
      case "tags":
        return <RenderTagsField field={field} config={config} label={label} placeholder={placeholder} />
      default:
        return <RenderDefaultField field={field} config={config} label={label} placeholder={placeholder} />
    }
  }

  return (
    <div key={field.name} className={cn(colSpanClass)}>
      {renderContent()}
    </div>
  )
}

export function getFieldType(key: string, unwrapped: z.ZodTypeAny): string {
  if (unwrapped instanceof z.ZodNumber) return "number"
  if (unwrapped instanceof z.ZodBoolean) return "boolean"
  if (unwrapped instanceof z.ZodDate) return "date"
  if (key.endsWith("Id")) return "entity"
  if (key === "note" || key === "description" || key === "content") return "textarea"
  if (unwrapped instanceof z.ZodArray) return "array"
  if (unwrapped instanceof z.ZodObject) return "object"
  return "string"
}
