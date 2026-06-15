"use client"

import { useT } from "@/shared/config"
import { useEntityConfig } from "@/core/entities/hooks"
import { CRUDDetailPage } from "./CRUDDetailPage"
import { BaseDetailRenderer } from "./BaseDetailRenderer"
import { useEntityPermissions } from "@/core/auth/context/PermissionContext"
import { RecordBreadcrumb, pickRecordName } from "./RecordBreadcrumb"

export interface ConfigDrivenDetailPageProps {
  /** Entity config name to load */
  entityConfigName: string
  /** Entity ID to display */
  id: string
  /** Custom back route */
  backRoute?: string
  /** Custom edit route */
  editRoute?: string
  /** Disable delete button */
  disableDelete?: boolean
  /** Custom sections to render */
  customSections?: React.ReactNode | ((entity: Record<string, unknown>) => React.ReactNode)
}

/**
 * Config-Driven Detail Page
 *
 * Automatically loads entity configuration and renders a complete CRUD detail page.
 * Uses BaseDetailRenderer with sections from entity config.
 *
 * @example
 * ```tsx
 * export default function BrandDetailPage({ params }: { params: { id: string } }) {
 *   return <ConfigDrivenDetailPage entityConfigName="brand" id={params.id} />
 * }
 * ```
 */
export function ConfigDrivenDetailPage({
  entityConfigName,
  id,
  backRoute,
  editRoute,
  disableDelete,
  customSections,
}: ConfigDrivenDetailPageProps) {
  const t = useT()

  // Load entity configuration
  const { config, isLoading: isConfigLoading } = useEntityConfig(entityConfigName)

  // Permission checks
  const entityPerms = useEntityPermissions(config?.permissionKey)

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

  return (
    <CRUDDetailPage
      service={
        config.service as {
          getById: (id: string) => Promise<{ id: string | number }>
          delete: (id: string) => Promise<void>
        }
      }
      id={id}
      title={t(config.translations.detailTitle)}
      entityName={config.entityName}
      renderDetails={entity => (
        <>
          <RecordBreadcrumb name={pickRecordName(entity)} listTitle={t(config.translations.listTitle)} />
          <BaseDetailRenderer
            entity={entity}
            sections={config.detailSections}
            customSections={
              <>
                {typeof config.customDetailSections === "function"
                  ? config.customDetailSections(entity)
                  : config.customDetailSections}
                {typeof customSections === "function" ? customSections(entity) : customSections}
              </>
            }
          />
        </>
      )}
      backRoute={backRoute || config.basePath || `/${config.entityName}`}
      editRoute={editRoute || `${config.basePath || `/${config.entityName}`}/${id}/edit`}
      disableDelete={disableDelete || !config.features?.delete || !entityPerms.canDelete}
      disableEdit={!entityPerms.canUpdate}
    />
  )
}
