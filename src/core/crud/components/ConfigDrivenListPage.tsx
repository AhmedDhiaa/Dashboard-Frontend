"use client"

import { useMemo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useT } from "@/shared/config"
import { useEntityConfig } from "@/core/entities/hooks"
import dynamic from "next/dynamic"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { createColumnsFromMetadata, createActionsColumn, type ColumnMetadata } from "@/ui/crud/renderers/table-column-factory"
import { EntityCardGrid } from "@/ui/crud/renderers/EntityCardGrid"
import { EntityTree } from "./EntityTree"
import { useConfirmDialog, useNotification } from "@/ui/application"
import { ViewToggle } from "@/ui/crud/components/ViewToggle"
import { useEntityPermissions, useColumnPermissions, usePermissionContext } from "@/core/auth/context/PermissionContext"
import type { SortingState } from "@tanstack/react-table"
import type { EntityConfig } from "@/core/entities/types"
import type { CRUDListPageProps } from "./CRUDListPage"

const CRUDListPage = dynamic(() => import("./CRUDListPage").then(mod => ({ default: mod.CRUDListPage })), {
  loading: () => <DataTableSkeleton />,
  ssr: true,
})

type EntityRow = Record<string, unknown> & { id: string | number }

// ============================================================================
// HELPER HOOKS - Split to keep complexity under 15
// ============================================================================

/** Filter fields with overrides applied */
function useFilterFields(config: EntityConfig<unknown, unknown> | null, overrides?: Record<string, object>) {
  return useMemo(() => {
    if (!config?.filterFields) return []
    if (!overrides) return config.filterFields
    return config.filterFields.map(f =>
      overrides[f.name]
        ? { ...f, ...overrides[f.name] }
        : (f as unknown as import("@/shared/types/filters").FilterField),
    )
  }, [config, overrides])
}

const useListPageColumns = <T extends EntityRow>(
  config: EntityConfig<unknown, unknown> | undefined,
  entityPerms: { canView: boolean; canUpdate: boolean; canDelete: boolean },
  finalBasePath: string,
) => {
  const allowedColumns = useColumnPermissions(config?.listColumns ?? [], config?.permissionKey)

  return useMemo(() => {
    if (!config || allowedColumns.length === 0) return []
    const dataColumns = createColumnsFromMetadata<T>(allowedColumns, finalBasePath)

    // Check if actions column already exists to avoid duplication
    const hasActionsColumn = dataColumns.some(col => col.id === "actions")
    if (hasActionsColumn) return dataColumns

    const hasView = config.features?.view !== false && entityPerms.canView
    const hasEdit = config.features?.edit !== false && entityPerms.canUpdate
    const hasDelete = config.features?.delete !== false && entityPerms.canDelete

    if (!hasView && !hasEdit && !hasDelete) return dataColumns

    return [
      ...dataColumns,
      createActionsColumn<T>(config.entityName, { view: hasView, edit: hasEdit, delete: hasDelete }, finalBasePath),
    ]
  }, [config, allowedColumns, entityPerms, finalBasePath])
}

const useListPageRouteConfig = (
  entityConfigName: string,
  customBasePath: string | undefined,
  config: EntityConfig<unknown, unknown> | undefined,
  entityPerms: { canCreate: boolean },
) => {
  const t = useT()

  const finalBasePath = useMemo(
    () => customBasePath || config?.basePath || `/${config?.entityName ?? entityConfigName}`,
    [customBasePath, config, entityConfigName],
  )

  const description = useMemo(
    () => (config?.translations?.listDescription ? t(config.translations.listDescription) : undefined),
    [config, t],
  )

  const createRoute = useMemo(() => config?.routes?.create ?? `${finalBasePath}/create/edit`, [config, finalBasePath])

  const canCreate = useMemo(
    () => config?.features?.create !== false && entityPerms.canCreate,
    [config, entityPerms.canCreate],
  )

  return { finalBasePath, description, createRoute, canCreate }
}

// ============================================================================
// TREE VIEW COMPONENT
// ============================================================================

interface TreeViewWrapperProps {
  config: EntityConfig<unknown, unknown>
  entities: Array<Record<string, unknown>>
  onRefresh: () => void
}

const useListPageRegistry = (entityConfigName: string, customBasePath?: string) => {
  const { isLoading: isPermissionsLoading } = usePermissionContext()
  const { config, isLoading: isConfigLoading } = useEntityConfig(entityConfigName)
  const entityPerms = useEntityPermissions(config?.permissionKey)

  const { finalBasePath, description, createRoute, canCreate } = useListPageRouteConfig(
    entityConfigName,
    customBasePath,
    config || undefined,
    entityPerms,
  )

  return {
    config,
    entityPerms,
    isInitialLoading: isPermissionsLoading || isConfigLoading,
    finalBasePath,
    description,
    createRoute,
    canCreate,
  }
}

const useListPageDisplayConfig = (
  config: EntityConfig<unknown, unknown> | undefined,
  entityPerms: { canView: boolean; canUpdate: boolean; canDelete: boolean },
  finalBasePath: string,
  filterFieldOverrides?: Record<string, Partial<import("@/shared/types/filters").FilterField>>,
) => {
  const columns = useListPageColumns<EntityRow>(config, entityPerms, finalBasePath)
  const filterFields = useFilterFields(config || null, filterFieldOverrides)
  const { renderSubComponent, IconComponent } = useListPageRenderHelpers(config)

  return { columns, filterFields, renderSubComponent, IconComponent }
}

function TreeViewWrapper({ config, entities, onRefresh }: TreeViewWrapperProps) {
  const router = useRouter()
  const t = useT()
  const notifications = useNotification()
  const { showConfirm } = useConfirmDialog()

  if (!config.treeConfig || entities.length === 0) return null

  const { treeConfig } = config
  const basePath = config.basePath ?? `/${config.entityName}`

  const handleDelete = (item: Record<string, unknown>) => {
    showConfirm(
      async () => {
        try {
          const service = config.service as { delete: (id: string) => Promise<void> }
          await service.delete(String(item.id))
          notifications.success("crud.messages.success_delete")
          onRefresh()
        } catch (error) {
          notifications.error(error)
        }
      },
      {
        title: t("common.deleteConfirmation"),
        description: t("crud.messages.confirm_delete_message"),
        confirmText: t("common.delete"),
        variant: "destructive",
      },
    )
  }

  return (
    <EntityTree
      items={entities}
      idField="id"
      parentIdField={treeConfig.parentIdField as keyof (typeof entities)[0]}
      labelField={treeConfig.labelField as keyof (typeof entities)[0]}
      orderField={treeConfig.orderField as keyof (typeof entities)[0]}
      initialExpanded={treeConfig.initialExpanded}
      onEdit={item => router.push(`${basePath}/${item.id}/edit`)}
      onDelete={handleDelete}
      onAddChild={parent => router.push(`${basePath}/create/edit?parentId=${parent.id}`)}
    />
  )
}

const useListPageRenderHelpers = (config: EntityConfig<unknown, unknown> | undefined) => {
  const renderSubComponent = useMemo(() => {
    if (!config?.renderSubComponent) return undefined
    const configRender = config.renderSubComponent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: { row: any }) => configRender(props.row.original)
  }, [config])

  const IconComponent = useMemo(() => config?.icon, [config])

  return { renderSubComponent, IconComponent }
}

const useListPageViewMode = (
  viewMode: "table" | "card",
  config: EntityConfig<unknown, unknown> | undefined,
  entities: Array<Record<string, unknown>>,
  basePath: string,
  perms: { canView: boolean; canUpdate: boolean; canDelete: boolean },
  onRefresh?: () => void,
  renderCustomView?: (data: Record<string, unknown>[]) => React.ReactNode,
  customView?: React.ReactNode,
) => {
  const showCardView = viewMode === "card"

  const treeView = useMemo(() => {
    if (!config?.treeConfig) return null
    return <TreeViewWrapper config={config} entities={entities} onRefresh={onRefresh || (() => {})} />
  }, [config, entities, onRefresh])

  // Card view: an explicit per-entity custom view wins; otherwise render the
  // GENERIC card grid from the same listColumns the table uses — so every
  // config-driven list gets a cards mode with zero per-entity code.
  const cardView = useMemo(() => {
    if (!config) return null
    const custom = renderCustomView?.(entities) ?? customView
    if (custom) return custom
    return (
      <EntityCardGrid
        columns={(config.listColumns ?? []) as ColumnMetadata[]}
        data={entities}
        basePath={basePath}
        perms={perms}
        features={config.features as { view?: boolean; edit?: boolean; delete?: boolean } | undefined}
        service={config.service as unknown as { delete: (id: string) => Promise<void> }}
        onRefresh={onRefresh}
      />
    )
  }, [config, entities, basePath, perms, onRefresh, renderCustomView, customView])

  return {
    showCardView,
    viewModeView: showCardView ? cardView : treeView,
    hideTable: Boolean(config?.treeConfig) || showCardView,
    // Tree entities manage their own view; everything else gets the table/card toggle.
    showToggle: !config?.treeConfig,
  }
}

export interface ConfigDrivenListPageProps {
  /** Entity config name to load */
  entityConfigName: string
  /** Custom action buttons to render alongside default actions */
  customActions?: React.ReactNode
  /** Custom view to render instead of table */
  customView?: React.ReactNode
  /** Callback when filters are applied */
  onFiltersApplied?: (filters: Record<string, unknown>) => void
  /** Callback when data changes */
  onDataChange?: (data: unknown[]) => void
  /** Function to render custom view with data */
  renderCustomView?: (data: Record<string, unknown>[]) => React.ReactNode
  /** Enable view toggle (Table/Custom) */
  enableViewToggle?: boolean
  /** Initial filters to apply */
  initialFilters?: Record<string, unknown>
  /** Override filter field properties (e.g., to disable or make required) */
  filterFieldOverrides?: Record<string, Partial<import("@/shared/types/filters").FilterField>>
  /** Custom title to override the entity default */
  title?: string
  /** Custom base path for routes */
  basePath?: string
  /** Disable create button */
  disableCreate?: boolean
}

/**
 * Config-Driven List Page
 */
export function ConfigDrivenListPage({
  entityConfigName,
  customActions,
  customView,
  onFiltersApplied,
  onDataChange,
  renderCustomView,
  enableViewToggle,
  initialFilters,
  filterFieldOverrides,
  title,
  basePath: customBasePath,
  disableCreate: disableCreateProp,
}: ConfigDrivenListPageProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [entities, setEntities] = useState<Array<Record<string, unknown>>>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<"table" | "card">("table")

  const registry = useListPageRegistry(entityConfigName, customBasePath)
  const display = useListPageDisplayConfig(
    registry.config || undefined,
    registry.entityPerms,
    registry.finalBasePath,
    filterFieldOverrides,
  )

  const handleDataChange = useCallback(
    (data: Record<string, unknown>[]) => {
      setEntities(data)
      onDataChange?.(data)
    },
    [onDataChange],
  )
  // Refresh = invalidate this entity's cached list queries (so tree/card views
  // refetch fresh after a mutation) + bump the remount key for good measure.
  const handleRefresh = useCallback(() => {
    const entityName = registry.config?.entityName
    if (entityName) void queryClient.invalidateQueries({ queryKey: [entityName] })
    setRefreshKey(prev => prev + 1)
  }, [queryClient, registry.config])
  const handleFiltersApplied = useCallback(
    (filters: Record<string, unknown>) => onFiltersApplied?.(filters),
    [onFiltersApplied],
  )

  const { viewModeView, hideTable, showToggle } = useListPageViewMode(
    viewMode,
    registry.config || undefined,
    entities,
    registry.finalBasePath,
    registry.entityPerms,
    handleRefresh,
    renderCustomView,
    customView,
  )

  // Translate the config's declarative defaultSort into the table's initial
  // SortingState. Previously defaultSort was declared on 52/54 configs but never
  // drove sorting — this seeds both the visual indicator and the first ABP
  // `Sorting` param.
  const initialSort = useMemo<SortingState>(() => {
    const ds = registry.config?.defaultSort
    return ds ? [{ id: String(ds.field), desc: ds.direction === "desc" }] : []
  }, [registry.config])

  if (registry.isInitialLoading) return <DataTableSkeleton />
  if (!registry.config)
    return <div className="p-8 text-center text-muted-foreground">{t("errors.configuration_not_found")}</div>

  const IconComponent = display.IconComponent

  return (
    <CRUDListPage
      key={`${entityConfigName}-${refreshKey}`}
      service={registry.config.service as unknown as CRUDListPageProps<EntityRow>["service"]}
      columns={display.columns}
      title={title || t(registry.config.translations.listTitle)}
      description={registry.description}
      icon={IconComponent ? <IconComponent className="h-5 w-5" /> : undefined}
      entityName={registry.config.entityName}
      searchPlaceholder={t(registry.config.translations.searchPlaceholder)}
      searchParam={registry.config.searchParam}
      defaultPageSize={registry.config.defaultPageSize ?? 20}
      createRoute={registry.createRoute}
      disableCreate={disableCreateProp !== undefined ? disableCreateProp : !registry.canCreate}
      filterFields={display.filterFields}
      initialFilters={initialFilters}
      onFiltersApplied={handleFiltersApplied}
      onDataChange={handleDataChange}
      customActions={
        <div className="flex items-center gap-3">
          {showToggle && enableViewToggle !== false && <ViewToggle mode={viewMode} onChange={setViewMode} />}
          {customActions}
        </div>
      }
      customView={viewModeView}
      hideTable={hideTable}
      renderSubComponent={display.renderSubComponent}
      initialSort={initialSort}
    />
  )
}
