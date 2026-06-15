"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { useMemo } from "react"
import { z as zod } from "zod"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormGridLayout } from "@/core/crud/components/FormGridLayout"
import { FormTabsLayout } from "@/core/crud/components/FormTabsLayout"
import { SectionedFormLayout } from "@/core/crud/components/SectionedFormLayout"
import { SplitFormLayout } from "@/core/crud/components/SplitFormLayout"
import { SchemaFormRenderer } from "@/core/crud/components/SchemaFormRenderer"
import type { FormFieldConfig } from "@/core/entities/types"
import { formBlock, type FormLayout } from "../../schema/block-schema"
import type { FieldSchema } from "../../schema/field-schema"
import type { BlockDefinition } from "../block-registry"
import { buildZodSchema, buildFieldConfig, buildDefaultValues } from "../../renderer/build-form-schema"

type FormBlockProps = z.infer<typeof formBlock>

/**
 * Schema-driven form block. The Zod resolver, fieldConfig, and default
 * values are built from `formBlock.fields[]` by the pure helpers in
 * `renderer/build-form-schema.ts`. The layout (grid / tabs / sections /
 * split) is dispatched recursively; each leaf row hosts a scoped
 * `SchemaFormRenderer` so RHF state is shared across the whole form via
 * a single `<FormProvider>`.
 */

type ZodShape = Record<string, zod.ZodTypeAny>

function pickSubShape(masterShape: ZodShape, fieldNames: readonly string[]): ZodShape {
  const sub: ZodShape = {}
  for (const name of fieldNames) {
    if (masterShape[name]) sub[name] = masterShape[name]!
  }
  return sub
}

interface RenderLayoutCtx {
  masterShape: ZodShape
  fieldConfig: Record<string, FormFieldConfig>
}

/**
 * Recursive layout dispatcher. Each `grid` layout becomes a series of
 * `FormGridLayout` rows where each row hosts a `SchemaFormRenderer`
 * scoped (via `fieldOrder`) to the row's field list. `tabs`/`sections`/
 * `split` recurse with the same logic for their nested layouts.
 */
function renderLayout(layout: FormLayout, ctx: RenderLayoutCtx): ReactNode {
  switch (layout.type) {
    case "grid":
      return (
        <div className="space-y-4">
          {layout.rows.map((row, idx) => {
            const subShape = pickSubShape(ctx.masterShape, row.fields)
            const subSchema = zod.object(subShape)
            return (
              <FormGridLayout key={`row-${idx}`} columns={row.columns}>
                <SchemaFormRenderer
                  schema={subSchema}
                  fieldConfig={ctx.fieldConfig}
                  fieldOrder={[...row.fields]}
                  strict
                  className={null}
                />
              </FormGridLayout>
            )
          })}
        </div>
      )
    case "tabs":
      return (
        <FormTabsLayout
          tabs={layout.tabs.map(tab => ({
            id: tab.id,
            title: tab.title.en,
            children: renderLayout(tab.layout, ctx),
            columns: 2 as const,
          }))}
        />
      )
    case "sections":
      return (
        <SectionedFormLayout
          sections={layout.sections.map(section => ({
            id: section.id,
            title: section.title.en,
            children: renderLayout(section.layout, ctx),
            columns: 2 as const,
            collapsible: section.collapsible,
            defaultOpen: section.defaultOpen,
          }))}
        />
      )
    case "split":
      return (
        <SplitFormLayout leftContent={renderLayout(layout.left, ctx)} rightContent={renderLayout(layout.right, ctx)} />
      )
  }
}

const FormBlockRender: ComponentType<FormBlockProps> = ({ fields, layout, hidden }) => {
  // RHF must always be called; hooks can't live behind a conditional.
  const masterSchema = useMemo(() => buildZodSchema(fields as FieldSchema[]), [fields])
  const fieldConfig = useMemo(() => buildFieldConfig(fields as FieldSchema[]), [fields])
  const defaultValues = useMemo(() => buildDefaultValues(fields as FieldSchema[]), [fields])

  const methods = useForm<Record<string, unknown>>({
    defaultValues,
    // Cast required because zodResolver's generic doesn't unify well with
    // dynamic `z.object(shape)` — same pattern entity CRUDEditPage uses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(masterSchema as any),
  })

  if (hidden) return null

  return (
    <FormProvider {...methods}>{renderLayout(layout, { masterShape: masterSchema.shape, fieldConfig })}</FormProvider>
  )
}

export const formBlockDefinition: BlockDefinition<FormBlockProps> = {
  type: "form",
  category: "form",
  displayName: { en: "Form", ar: "نموذج" },
  icon: "FormInput",
  description: {
    en: "Schema-driven form with grid / tabs / sections / split layouts.",
    ar: "نموذج مدفوع بالـ schema.",
  },
  propsSchema: formBlock,
  defaultProps: formBlock.parse({
    id: "form-1",
    type: "form",
    fields: [],
    layout: { type: "grid", rows: [] },
    submitAction: { type: "api", method: "POST", endpoint: "/items" },
  }),
  Render: FormBlockRender,
  wraps: {
    componentPath: "src/core/crud/components/SchemaFormRenderer.tsx",
    componentName: "SchemaFormRenderer + FormGridLayout/FormTabsLayout/SectionedFormLayout/SplitFormLayout",
  },
}
