"use client"

/**
 * Recursive form-layout dispatcher (per spec §6).
 *
 * Walks a `FormLayout` value (grid / tabs / sections / split — possibly
 * nested) and instantiates the matching layout component from
 * `@/core/crud/components/`. Each layout type recurses through this same
 * component for nested layouts, which is what spec §6 §missingPieces (M15)
 * called for: orchestration only — the four layout components are reused
 * as-is, no new layout primitive.
 *
 * Field rendering itself stays out of this file — callers pass a
 * `renderField(name)` callback. That keeps FormLayoutRenderer reusable
 * regardless of which renderer the caller uses for field cells (a Phase 3+
 * SchemaFormRenderer adapter, a stub for tests, etc.).
 */

import { Fragment, type ReactNode } from "react"
import { FormGridLayout } from "@/core/crud/components/FormGridLayout"
import { FormTabsLayout } from "@/core/crud/components/FormTabsLayout"
import { SectionedFormLayout } from "@/core/crud/components/SectionedFormLayout"
import { SplitFormLayout } from "@/core/crud/components/SplitFormLayout"
import type { FormLayout } from "../schema/block-schema"

export interface FormLayoutRendererProps {
  layout: FormLayout
  /**
   * Render a single field by name. Caller resolves `name` to a field
   * config + JSX. When the layout is recursive (e.g. tabs) this callback
   * is shared across every level — fields are global to the form, not
   * scoped to a tab.
   */
  renderField: (fieldName: string) => ReactNode
}

export function FormLayoutRenderer({ layout, renderField }: FormLayoutRendererProps) {
  switch (layout.type) {
    case "grid":
      return (
        <div className="space-y-4">
          {layout.rows.map((row, rowIdx) => (
            <FormGridLayout key={rowIdx} columns={row.columns}>
              {row.fields.map(name => (
                <Fragment key={name}>{renderField(name)}</Fragment>
              ))}
            </FormGridLayout>
          ))}
        </div>
      )

    case "tabs":
      return (
        <FormTabsLayout
          tabs={layout.tabs.map(tab => ({
            id: tab.id,
            title: tab.title.en,
            children: <FormLayoutRenderer layout={tab.layout} renderField={renderField} />,
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
            children: <FormLayoutRenderer layout={section.layout} renderField={renderField} />,
            columns: 2 as const,
            collapsible: section.collapsible,
            defaultOpen: section.defaultOpen,
          }))}
        />
      )

    case "split":
      return (
        <SplitFormLayout
          leftContent={<FormLayoutRenderer layout={layout.left} renderField={renderField} />}
          rightContent={<FormLayoutRenderer layout={layout.right} renderField={renderField} />}
        />
      )
  }
}
