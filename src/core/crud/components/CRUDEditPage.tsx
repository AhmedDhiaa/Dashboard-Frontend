/**
 * UNIFIED CRUD EDIT PAGE COMPONENT
 *
 * - Fully generic and reusable across all entities
 * - No hardcoded business logic
 * - Type-safe with proper generics
 * - Supports custom transformations via props
 *
 * @strict @enterprise-grade @reusable
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useForm,
  FormProvider,
  FieldValues,
  FieldPath,
  type UseFormReturn,
  type ResolverResult,
  type ResolverOptions,
  type FieldErrors,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ZodSchema } from "zod"
import { Card, CardContent, CardHeader, CardTitle, CardActionButton } from "@/ui/design-system/primitives/card"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { useT } from "@/shared/config"
import { useNotification } from "@/ui/application"
import type { BaseCRUDService } from "@/infra/api"
import { RecordBreadcrumb, pickRecordName } from "./RecordBreadcrumb"

/**
 * Show an error notification from any error shape.
 * Detects generic HTTP status messages and replaces them with a user-friendly fallback.
 */
function showErrorNotification(
  error: unknown,
  errorMessage: string | undefined,
  t: ReturnType<typeof useT>,
  notifications: ReturnType<typeof useNotification>,
) {
  let message: string

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  } else {
    message = errorMessage || t("errors.something_went_wrong")
  }

  // Replace generic HTTP status messages with a friendlier fallback
  if (message.includes("Request failed with status code")) {
    message = t("errors.something_went_wrong")
  }

  notifications.error(message)
}

async function handleServerError<TFormValues extends FieldValues>(
  error: unknown,
  methods: UseFormReturn<TFormValues>,
  notifications: ReturnType<typeof useNotification>,
  t: ReturnType<typeof useT>,
  _isCreate: boolean,
  _entityName: string,
) {
  const { AppError } = await import("@/infra/api")

  if (error instanceof AppError) {
    // Check if error.details exists and is an object
    if (!error.details || typeof error.details !== "object") {
      showErrorNotification(error.message, error.message, t, notifications)
      return
    }

    const errorData = error.details as
      | {
          validationErrors?: { message: string; members: string[] | null }[]
          details?: string
        }
      | Record<string, string[] | string>

    if ("validationErrors" in errorData && Array.isArray(errorData.validationErrors)) {
      // Parse validation errors like "City:Validate:Required:CountryId"
      let hasFieldErrors = false

      errorData.validationErrors.forEach(validationError => {
        const errorMessage = typeof validationError === "string" ? validationError : validationError.message
        const parts = errorMessage.split(":")

        if (parts.length >= 2) {
          const fieldName = parts[parts.length - 1]
          if (!fieldName) return

          const fieldPath = fieldName.charAt(0).toLowerCase() + fieldName.slice(1)
          const errorType = parts[parts.length - 2] || "validation"

          let userMessage = errorMessage
          if (errorType === "Required") userMessage = t("common.validation.required")
          else if (errorType === "NotExists") userMessage = t("errors.field_not_exists")
          else if (errorType === "Invalid") userMessage = t("errors.field_invalid")
          else if (errorType === "Duplicate") userMessage = t("errors.field_duplicate")

          methods.setError(fieldPath as FieldPath<TFormValues>, {
            type: "server",
            message: userMessage,
          })
          hasFieldErrors = true
        }
      })

      if (hasFieldErrors) {
        notifications.error(t("errors.validation_failed"))
        setTimeout(() => {
          const firstError = document.querySelector('[aria-invalid="true"]')
          if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 100)
      } else {
        const errorMessage = errorData.details || error.message || t("errors.something_went_wrong")
        notifications.error(errorMessage)
      }
    } else if ("validationErrors" in errorData) {
      // Has validationErrors key but empty or wrong format
      notifications.error(t("errors.validation_failed"))
    } else if (typeof errorData === "object" && Object.keys(errorData).length > 0) {
      // Old format - object with field names as keys
      const details = errorData as Record<string, string[] | string>
      Object.entries(details).forEach(([key, value]) => {
        const message = Array.isArray(value) ? value[0] : String(value)
        methods.setError(key as FieldPath<TFormValues>, { type: "server", message })
      })
      notifications.error(t("errors.validation_failed"))
    } else {
      // No recognizable error structure
      showErrorNotification(error.message, error.message, t, notifications)
    }
  } else {
    showErrorNotification(error, undefined, t, notifications)
  }
}

export interface CRUDEditPageProps<TEntity extends { id: string | number }, TFormValues extends FieldValues> {
  /** Service instance for API calls */
  service: Pick<BaseCRUDService<TEntity, unknown, unknown>, "getById" | "create" | "update">
  /** Entity ID (undefined for create) */
  id?: string
  /** Page title */
  title: string
  /** Entity name (singular, lowercase) for routes */
  entityName: string
  /** Zod validation schema */
  schema: ZodSchema<TFormValues>
  /** Default form values for create */
  defaultValues: TFormValues
  /** Custom render function for form fields */
  renderForm: (methods: ReturnType<typeof useForm<TFormValues>>) => React.ReactNode
  /** Back route */
  backRoute?: string
  /** Transform entity to form data (for loading) */
  entityToFormData?: (entity: TEntity) => TFormValues
  /** Transform form data to create payload */
  transformCreatePayload?: (formValues: TFormValues) => Partial<TFormValues>
  /** Transform form data to update payload (with access to original entity) */
  transformUpdatePayload?: (formValues: TFormValues, originalEntity: TEntity | null) => Partial<TFormValues>
  /** Success message */
  successMessage?: string
  /** Entity list title (already translated) for the per-record breadcrumb subtitle. */
  listTitle?: string
}

// eslint-disable-next-line max-lines-per-function -- CRUD edit page with form handling, validation, and submit logic
export function CRUDEditPage<TEntity extends { id: string | number }, TFormValues extends FieldValues = FieldValues>({
  service,
  id,
  title,
  entityName,
  schema,
  defaultValues,
  renderForm,
  backRoute,
  entityToFormData,
  transformCreatePayload,
  transformUpdatePayload,
  successMessage,
  listTitle,
}: CRUDEditPageProps<TEntity, TFormValues>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useT()
  const notifications = useNotification()
  const isCreate = !id || id === "create"
  const [loading, setLoading] = useState(!isCreate)
  const [submitting, setSubmitting] = useState(false)
  const [originalEntity, setOriginalEntity] = useState<TEntity | null>(null)

  // Safe resolver wrapper that prevents unhandled promise rejections
  const safeResolver = async (
    values: TFormValues,
    context: unknown,
    options: ResolverOptions<TFormValues>,
  ): Promise<ResolverResult<TFormValues>> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await zodResolver(schema as any)(values, context, options as any)
    } catch (error) {
      // Catch ZodError and return it properly formatted for react-hook-form
      if (error && typeof error === "object" && "issues" in error) {
        const issues = (error as { issues: { path: (string | number)[]; message: string; code: string }[] }).issues
        const errors = {} as FieldErrors<TFormValues>

        issues.forEach(issue => {
          const fieldPath = issue.path.join(".") as FieldPath<TFormValues>
          if (fieldPath) {
            ;(errors as Record<string, { type: string; message: string }>)[fieldPath] = {
              type: issue.code || "validation",
              message: issue.message,
            }
          }
        })

        return {
          values: {},
          errors,
        }
      }

      // Re-throw if not a ZodError
      throw error
    }
  }

  const methods = useForm<TFormValues>({
    resolver: safeResolver,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues as any,
    // Validate on blur to avoid jittery per-keystroke errors; re-validate on
    // change so users see corrections take effect immediately after fixing.
    mode: "onBlur",
    reValidateMode: "onChange",
    criteriaMode: "all",
  })

  // Load entity if editing
  useEffect(() => {
    if (isCreate) {
      // Check for query parameters to pre-fill form fields
      const params = Object.fromEntries(searchParams.entries())
      if (Object.keys(params).length > 0) {
        Object.entries(params).forEach(([key, value]) => {
          // If value is a number string, try to coerce it (needed for IDs)
          const coercedValue = !isNaN(Number(value)) && value.trim() !== "" ? Number(value) : value
          methods.setValue(key as FieldPath<TFormValues>, coercedValue as TFormValues[FieldPath<TFormValues>], {
            shouldDirty: true,
          })
        })
      }
      setLoading(false)
      return
    }

    const loadEntity = async () => {
      try {
        setLoading(true)
        const data = await service.getById(id)
        setOriginalEntity(data)
        const formData = entityToFormData ? entityToFormData(data) : (data as unknown as TFormValues)
        methods.reset(formData)
      } catch (error: unknown) {
        notifications.error(error)
        router.push(backRoute || `/${entityName}`)
      } finally {
        setLoading(false)
      }
    }

    loadEntity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCreate, service, entityName, backRoute, entityToFormData])

  const onSubmit = async (formValues: TFormValues) => {
    try {
      setSubmitting(true)

      if (isCreate) {
        const createPayload = transformCreatePayload ? transformCreatePayload(formValues) : formValues
        await service.create(createPayload)
      } else {
        const updatePayload = transformUpdatePayload ? transformUpdatePayload(formValues, originalEntity) : formValues
        await service.update(id, updatePayload)
      }

      const messageKey = isCreate ? t("crud.messages.success_create") : t("crud.messages.success_update")
      notifications.success(successMessage || messageKey)
      router.push(backRoute || `/${entityName}`)
    } catch (error: unknown) {
      handleServerError(error, methods, notifications, t, isCreate, entityName)
    } finally {
      setSubmitting(false)
    }
  }

  /** Scroll to the first invalid field after a short delay for React to render */
  function scrollToFirstError() {
    setTimeout(() => {
      const firstInvalid = document.querySelector('[aria-invalid="true"]')
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 100)
  }

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">{t("common.loading_details")}</p>
            <p className="text-xs text-muted-foreground">{t("common.preparing_form")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Per-record breadcrumb (edit mode only). `record={false}` keeps the
          edit URL out of the command palette's "Recent" deep links. */}
      <RecordBreadcrumb
        name={!isCreate && originalEntity ? pickRecordName(originalEntity as Record<string, unknown>) : null}
        listTitle={listTitle ?? title}
        record={false}
      />
      {/*
       * Edit page shell: NO Card border/background on the outer wrapper —
       * the page already sits inside the dashboard layout, which provides
       * its own surface. The sticky header is the only floating layer;
       * the form body scrolls under it.
       */}
      <Card className="h-full flex flex-col bg-transparent border-none shadow-none rounded-none">
        {/* Sticky page header: title on the start, actions on the end.
            Solid bg-card so scrolling rows don't bleed through. */}
        <CardHeader
          className="sticky top-0 z-20 bg-card border-b border-border shadow-sm"
          actions={
            <div className="flex items-center gap-2">
              <CardActionButton
                icon={<ArrowLeft className="h-4 w-4 rtl:rotate-180" />}
                onClick={() => router.push(backRoute || `/${entityName}`)}
                variant="outline"
                tooltip={t("common.back")}
                disabled={submitting}
                name={t("common.back")}
              />
              <CardActionButton
                icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                onClick={async e => {
                  e?.preventDefault()
                  await methods
                    .handleSubmit(
                      async data => {
                        await onSubmit(data)
                      },
                      _errors => {
                        notifications.error(t("errors.validation_failed"))
                        scrollToFirstError()
                      },
                    )(e)
                    .catch(err => {
                      // Catch ZodErrors that escape the resolver and set field errors manually
                      const issues = err?.issues || err?.errors
                      if (issues && Array.isArray(issues)) {
                        issues.forEach((issue: { path?: string[]; code?: string; message: string }) => {
                          const fieldPath = issue.path?.join(".")
                          if (fieldPath) {
                            methods.setError(fieldPath as FieldPath<TFormValues>, {
                              type: issue.code || "validation",
                              message: issue.message,
                            })
                          }
                        })
                        scrollToFirstError()
                      }
                    })
                }}
                variant="primary"
                tooltip={isCreate ? t("common.create") : t("common.update")}
                disabled={submitting}
                name={isCreate ? t("common.save") : t("common.update")}
              />
            </div>
          }
        >
          {/* Title — single-line, semibold, no display weight. The page is
              about editing the entity, not announcing its name. */}
          <CardTitle>{title}</CardTitle>
        </CardHeader>

        {/* Scrollable form body. max-w-5xl on the inner container caps the
            line length at a comfortable reading width on ultra-wide
            monitors; the surrounding shell can still go edge-to-edge. */}
        <CardContent className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <FormProvider {...methods}>
              <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                {renderForm(methods)}
              </form>
            </FormProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
