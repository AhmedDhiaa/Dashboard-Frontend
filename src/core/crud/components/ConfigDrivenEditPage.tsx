"use client"

import React, { useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/shared/config"
import { useEntityConfig } from "@/core/entities/hooks"
import { CRUDEditPage } from "./CRUDEditPage"
import { SchemaFormRenderer } from "./SchemaFormRenderer"
import { SplitFormLayout } from "./SplitFormLayout"
import { FormGridLayout } from "./FormGridLayout"
import { SectionedFormLayout } from "./SectionedFormLayout"
import { FormTabsLayout } from "./FormTabsLayout"
import { FormCompositionLayout, type FormCompositionRow } from "./FormCompositionLayout"
import { z } from "zod"
import type { EntityConfig } from "@/core/entities/types"
import { useEntityPermissions } from "@/core/auth/context/PermissionContext"

export interface ConfigDrivenEditPageProps {
  /** Entity config name to load */
  entityConfigName: string
  /** Entity ID for edit mode (undefined for create mode) */
  id?: string
  /** Custom back route */
  backRoute?: string
  /** Custom success message */
  successMessage?: string
  /** Default values to merge with entity defaults (for create mode) */
  defaultValues?: Record<string, unknown>
}

/**
 * Config-Driven Edit/Create Page
 *
 * Automatically loads entity configuration and renders a complete CRUD edit/create page.
 * Uses SchemaFormRenderer with fields and order from entity config.
 * Handles both create and edit modes based on presence of ID.
 *
 * @example
 * ```tsx
 * export default function BrandEditPage({ params }: { params: { id: string } }) {
 *   return <ConfigDrivenEditPage entityConfigName="brand" id={params.id} />
 * }
 * ```
 */

/**
 * Helper component to render the appropriate form layout based on configuration
 */
/**
 * Individual layout renderers to reduce line count of main LayoutRenderer
 */

const SplitLayout = ({
  config,
  schema,
}: {
  config: EntityConfig<unknown, unknown>
  schema: z.ZodObject<z.ZodRawShape>
}) => {
  if (config.formLayout?.type !== "split") return null
  const { leftFields, rightFields, leftWidth, rightWidth, gap } = config.formLayout
  return (
    <SplitFormLayout
      leftWidth={leftWidth}
      rightWidth={rightWidth}
      gap={gap}
      leftContent={
        <SchemaFormRenderer
          schema={schema}
          excludeFields={[...rightFields, ...(config.excludeFields || [])]}
          fieldOrder={leftFields}
          fieldConfig={config.formFields}
        />
      }
      rightContent={
        <SchemaFormRenderer
          schema={schema}
          excludeFields={[...leftFields, ...(config.excludeFields || [])]}
          fieldOrder={rightFields}
          fieldConfig={config.formFields}
        />
      }
    />
  )
}

const SectionsLayout = ({
  config,
  schema,
}: {
  config: EntityConfig<unknown, unknown>
  schema: z.ZodObject<z.ZodRawShape>
}) => {
  if (config.formLayout?.type !== "sections") return null
  const { sections, gap } = config.formLayout
  const sectionDefs = sections.map(section => ({
    ...section,
    children: (
      <SchemaFormRenderer
        schema={schema}
        excludeFields={config.excludeFields || []}
        fieldOrder={section.fields as string[]}
        fieldConfig={config.formFields}
        strict={true}
        className={null}
      />
    ),
  }))
  return <SectionedFormLayout sections={sectionDefs} gap={gap} />
}

const TabsLayout = ({
  config,
  schema,
}: {
  config: EntityConfig<unknown, unknown>
  schema: z.ZodObject<z.ZodRawShape>
}) => {
  if (config.formLayout?.type !== "tabs") return null
  const { tabs, gap } = config.formLayout
  const tabDefs = tabs.map(tab => {
    let children: React.ReactNode
    let rowDefs: FormCompositionRow[] | undefined

    if (tab.rows && tab.rows.length > 0) {
      rowDefs = tab.rows.map(row => ({
        ...row,
        children: (
          <SchemaFormRenderer
            schema={schema}
            excludeFields={config.excludeFields || []}
            fieldOrder={row.fields as string[]}
            fieldConfig={config.formFields}
            strict={true}
            className={null}
          />
        ),
      }))
      children = <FormCompositionLayout rows={rowDefs} gap={rowDefs[0]?.gap || gap} />
    } else {
      children = (
        <SchemaFormRenderer
          schema={schema}
          excludeFields={config.excludeFields || []}
          fieldOrder={tab.fields as string[]}
          fieldConfig={config.formFields}
          strict={true}
          className={null}
        />
      )
    }

    return {
      ...tab,
      rows: tab.rows && tab.rows.length > 0 ? rowDefs : undefined,
      children,
    }
  })
  return <FormTabsLayout tabs={tabDefs} gap={gap} />
}

const CompositionLayout = ({
  config,
  schema,
}: {
  config: EntityConfig<unknown, unknown>
  schema: z.ZodObject<z.ZodRawShape>
}) => {
  if (config.formLayout?.type !== "composition") return null
  const { rows, gap } = config.formLayout
  const rowDefs = rows.map(row => ({
    ...row,
    children: (
      <SchemaFormRenderer
        schema={schema}
        excludeFields={config.excludeFields || []}
        fieldOrder={row.fields as string[]}
        fieldConfig={config.formFields}
        strict={true}
        className={null}
      />
    ),
  }))
  return <FormCompositionLayout rows={rowDefs} gap={gap} />
}

function LayoutRenderer({
  config,
  schema,
}: {
  config: EntityConfig<unknown, unknown>
  schema: z.ZodObject<z.ZodRawShape>
}) {
  const layout = config.formLayout?.type

  if (layout === "split") return <SplitLayout config={config} schema={schema} />
  if (layout === "sections") return <SectionsLayout config={config} schema={schema} />
  if (layout === "tabs") return <TabsLayout config={config} schema={schema} />
  if (layout === "composition") return <CompositionLayout config={config} schema={schema} />

  if (layout === "grid") {
    return (
      <FormGridLayout
        columns={config.formLayout?.type === "grid" ? config.formLayout.columns : 1}
        gap={config.formLayout?.gap}
      >
        <SchemaFormRenderer
          schema={schema}
          excludeFields={config.excludeFields || []}
          fieldOrder={config.formFieldOrder}
          fieldConfig={config.formFields}
        />
      </FormGridLayout>
    )
  }

  return (
    <SchemaFormRenderer
      schema={schema}
      excludeFields={config.excludeFields || []}
      fieldOrder={config.formFieldOrder}
      fieldConfig={config.formFields}
    />
  )
}

/**
 * Config-Driven Edit/Create Page
 */
export function ConfigDrivenEditPage({
  entityConfigName,
  id,
  backRoute,
  successMessage,
  defaultValues: customDefaultValues,
}: ConfigDrivenEditPageProps) {
  const t = useT()
  const router = useRouter()

  // Load entity configuration
  const { config, isLoading: isConfigLoading } = useEntityConfig(entityConfigName)

  // Determine if create or edit mode
  const isEditMode = !!id

  // Permission check: create requires Create permission, edit requires Update permission
  const entityPerms = useEntityPermissions(config?.permissionKey)
  const hasRequiredPermission = isEditMode ? entityPerms.canUpdate : entityPerms.canCreate

  // Select appropriate schema
  const schema = useMemo(() => {
    if (!config) return null
    return isEditMode ? config.updateSchema(t) : config.createSchema(t)
  }, [isEditMode, config, t])

  // Memoize the renderForm function to prevent unnecessary re-creation
  const renderForm = useCallback(() => {
    if (!config || !schema) return null
    return <LayoutRenderer config={config} schema={schema as z.ZodObject<z.ZodRawShape>} />
  }, [config, schema])

  // Redirect to 403 if user lacks required permission.
  // We do this imperatively (not in useEffect) to avoid a flash of null:
  // show the loading spinner until config is ready, then redirect synchronously.
  React.useEffect(() => {
    if (config && !hasRequiredPermission) {
      router.replace("/403")
    }
  }, [hasRequiredPermission, config, router])

  if (isConfigLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t("errors.configuration_for_not_found", { name: entityConfigName })}
      </div>
    )
  }

  // Config loaded but permission denied — show spinner while redirect fires
  if (!hasRequiredPermission) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Determine title
  const title = isEditMode ? t(config.translations.editTitle) : t(config.translations.createTitle)

  return (
    <CRUDEditPage
      service={
        config.service as {
          getById: (id: string) => Promise<{ id: string | number }>
          create: (data: unknown) => Promise<{ id: string | number }>
          update: (id: string, data: unknown) => Promise<{ id: string | number }>
        }
      }
      id={id}
      title={title}
      listTitle={t(config.translations.listTitle)}
      entityName={config.entityName}
      schema={schema as z.ZodType<Record<string, unknown>>}
      defaultValues={{
        ...(config.defaultFormValues as Record<string, unknown>),
        ...customDefaultValues,
      }}
      renderForm={renderForm}
      backRoute={backRoute || config.basePath || `/${config.entityName}`}
      entityToFormData={
        config.entityToFormData as ((entity: { id: string | number }) => Record<string, unknown>) | undefined
      }
      transformCreatePayload={
        config.transformCreatePayload as ((data: Record<string, unknown>) => Record<string, unknown>) | undefined
      }
      transformUpdatePayload={
        config.transformUpdatePayload as ((data: Record<string, unknown>) => Record<string, unknown>) | undefined
      }
      successMessage={
        successMessage ||
        (isEditMode
          ? config.translations.successUpdate || "crud.messages.success_update"
          : config.translations.successCreate || "crud.messages.success_create")
      }
    />
  )
}
