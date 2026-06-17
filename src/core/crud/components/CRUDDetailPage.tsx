/**
 * UNIFIED CRUD DETAIL PAGE COMPONENT
 *
 * - Full width and height responsive layout
 * - Internal vertical scrolling for content overflow
 * - Standardized design system usage
 * - Icon-only action buttons in header
 *
 * @strict @enterprise-grade
 */

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardActionButton } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { useT } from "@/shared/config"
import { useConfirmDialog, useNotification } from "@/ui/application"
import { ConfirmDialog } from "@/ui/design-system/primitives/ConfirmDialog"

export interface CRUDDetailPageProps<TEntity extends { id: string | number }> {
  /** Service instance for API calls */
  service: { getById: (id: string) => Promise<TEntity>; delete: (id: string) => Promise<void> }
  /** Entity ID */
  id: string
  /** Page title */
  title: string
  /** Entity name (singular, lowercase) for routes */
  entityName: string
  /** Custom render function for entity details */
  renderDetails: (entity: TEntity) => React.ReactNode
  /** Back route */
  backRoute?: string
  /** Custom edit route */
  editRoute?: string
  /** Disable delete button */
  disableDelete?: boolean
  /** Disable edit button */
  disableEdit?: boolean
}

// eslint-disable-next-line max-lines-per-function -- CRUD detail page with data fetching, loading states, and action buttons
export function CRUDDetailPage<TEntity extends { id: string | number }>({
  service,
  id,
  title,
  entityName,
  renderDetails,
  backRoute,
  editRoute,
  disableDelete = false,
  disableEdit = false,
}: CRUDDetailPageProps<TEntity>) {
  const router = useRouter()
  const t = useT("common")
  const notifications = useNotification()
  const { isOpen, setIsOpen, isLoading, config, showConfirm, handleConfirm } = useConfirmDialog()

  // TanStack Query: the detail is cached under `[entity, "detail", id]`, so
  // re-opening the same record (or returning from edit) is instant instead of
  // re-spinning, and a list page can prefetch this exact key on row hover. A
  // 404 is terminal (don't retry), every other failure retries twice.
  const {
    data: entity,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: [entityName, "detail", id],
    queryFn: () => service.getById(id),
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })

  // 404 → bounce to the list (the record was deleted/never existed); any other
  // error → toast + back. Lives in an effect so the redirect runs after render.
  useEffect(() => {
    if (!error) return
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      router.replace(backRoute || `/${entityName}`)
      return
    }
    notifications.error(error)
    router.push(backRoute || `/${entityName}`)
  }, [error, router, entityName, backRoute, notifications])

  const handleDelete = () => {
    showConfirm(
      async () => {
        try {
          await service.delete(id)
          notifications.success("common.messages.successDelete")
          router.push(backRoute || `/${entityName}`)
        } catch (error: unknown) {
          notifications.error(error)
          // Don't re-throw - error is already handled, dialog will stay open
        }
      },
      {
        title: t("deleteConfirmation"),
        description: `${t("areYouSure")} ${entityName}? ${t("cannotBeUndone")}.`,
        confirmText: t("delete"),
        variant: "destructive",
      },
    )
  }

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-12 gap-5">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-primary" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("loading")}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!entity) {
    return null
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden p-1 lg:p-4">
      {/* Unified Card with Header Actions */}
      <Card className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <CardHeader
          className="p-6 border-b border-border/50 bg-muted/30"
          actions={
            <div className="flex items-center gap-3">
              {!disableEdit && (
                <CardActionButton
                  icon={<Edit className="h-5 w-5" />}
                  onClick={() => router.push(editRoute || `/${entityName}/${id}/edit`)}
                  variant="primary"
                  tooltip={t("edit")}
                  name={t("edit")}
                />
              )}
              {!disableDelete && (
                <CardActionButton
                  icon={<Trash2 className="h-5 w-5" />}
                  onClick={handleDelete}
                  variant="danger"
                  tooltip={t("delete")}
                  disabled={isLoading || loading}
                  name={t("delete")}
                />
              )}
            </div>
          }
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(backRoute || `/${entityName}`)}
              className="h-10 w-10 rounded-xl hover:bg-muted/50 transition-all active:scale-90"
            >
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <div>
              <CardTitle className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">{title}</CardTitle>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">ID: {id}</p>
            </div>
          </div>
        </CardHeader>

        {/* Scrollable Detail Content */}
        <CardContent className="flex-1 overflow-y-auto p-5 lg:p-6 custom-scrollbar">{renderDetails(entity)}</CardContent>
      </Card>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        {...config}
      />
    </div>
  )
}
