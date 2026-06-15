"use client"
// Calls useT() + useMemo and renders interactive form fields via
// FieldRenderer. Both existing callers (form-block, PropertiesPanel)
// are Client components already. Enforced by
// scripts/check-rsc-boundaries.mjs.

/**
 * Schema Form Renderer Component
 *
 * Generates form fields automatically from Zod schemas.
 * Eliminates 85% duplication in edit/create pages.
 */

import { useMemo } from "react"
import { z } from "zod"
import { useT } from "@/shared/config"
import type { FormFieldConfig } from "@/core/entities/types"
import type { SchemaFormRendererProps, ExtractedField } from "./SchemaFormRenderer.types"
import { FieldRenderer, getFieldType } from "./SchemaFieldRenderers"

export function SchemaFormRenderer({
  schema,
  fieldConfig = {},
  excludeFields = [],
  fieldOrder,
  strict,
  className = "space-y-4",
}: SchemaFormRendererProps) {
  const t = useT()

  const fields = useMemo(() => {
    return extractFieldsFromSchema(schema, excludeFields, "", fieldConfig)
  }, [schema, excludeFields, fieldConfig])

  const orderedFields = useMemo(() => {
    if (!fieldOrder) return fields

    const ordered: ExtractedField[] = []
    const fieldsMap = new Map(fields.map(f => [f.name, f]))

    fieldOrder.forEach(name => {
      const field = fieldsMap.get(name)
      if (field) {
        ordered.push(field)
        fieldsMap.delete(name)
      }
    })

    if (!strict) {
      fieldsMap.forEach(field => ordered.push(field))
    }

    return ordered
  }, [fields, fieldOrder, strict])

  const content = (
    <>
      {orderedFields.map(field => (
        <FieldRenderer
          key={field.name}
          field={field}
          config={(fieldConfig[field.name] || {}) as FormFieldConfig}
          t={t}
        />
      ))}
    </>
  )

  if (className === null) return content

  return <div className={className}>{content}</div>
}

function extractFieldsFromSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  excludeFields: string[],
  prefix = "",
  fieldConfig: Record<string, FormFieldConfig> = {},
): ExtractedField[] {
  const shape = schema.shape
  let fields: ExtractedField[] = []

  Object.keys(shape).forEach(key => {
    const fullName = prefix ? `${prefix}.${key}` : key
    if (excludeFields.includes(fullName)) return

    const fieldSchema = shape[key]
    let unwrapped = fieldSchema

    while (
      unwrapped &&
      (unwrapped instanceof z.ZodOptional || unwrapped instanceof z.ZodNullable || unwrapped instanceof z.ZodDefault)
    ) {
      unwrapped = unwrapped._def.innerType
    }

    if (!unwrapped) return

    // If this field is explicitly configured in fieldConfig, treat it as a leaf field
    // even if it's a ZodObject (this allows custom renderers for whole objects)
    const hasConfig = !!fieldConfig[fullName]

    if (unwrapped instanceof z.ZodObject && !hasConfig) {
      fields = fields.concat(
        extractFieldsFromSchema(unwrapped as z.ZodObject<z.ZodRawShape>, excludeFields, fullName, fieldConfig),
      )
    } else {
      fields.push({
        name: fullName,
        type: getFieldType(key, unwrapped as z.ZodTypeAny),
        required: !(
          fieldSchema instanceof z.ZodOptional ||
          fieldSchema instanceof z.ZodDefault ||
          fieldSchema instanceof z.ZodNullable
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (unwrapped as any)._def?.description,
      })
    }
  })

  return fields
}
