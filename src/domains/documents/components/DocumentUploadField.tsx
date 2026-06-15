/**
 * Generic Document Upload Field
 * Integrates the generic FileUploader UI primitive with the documents domain
 * service. Lives in the documents domain because it knows about
 * ENTITY_REF_TYPE_MAP and documentService — both domain concerns.
 */

"use client"

import { useCallback } from "react"
import { useFormContext } from "react-hook-form"
import { FileUploader } from "@/ui/application/file-uploader"
import { Label } from "@/ui/design-system/primitives/label"
import { FormItem, FormMessage } from "@/ui/design-system/primitives/form"
import { ENTITY_REF_TYPE_MAP } from "../constants"
import { documentService } from "../document.service"

interface DocumentUploadFieldProps {
  entityName: string
  entityId?: string
  label?: string
  description?: string
  accept?: string
  maxSize?: number
  maxFiles?: number
  multiple?: boolean
}

export function DocumentUploadField({
  entityName,
  entityId,
  label,
  description,
  accept,
  maxSize,
  maxFiles = 1,
  multiple = false,
}: DocumentUploadFieldProps) {
  const formContext = useFormContext()

  // If no entityId is provided, try to get it from the form (e.g., when editing)
  const currentId = entityId || (formContext ? formContext.watch("id") : undefined)
  const refType = ENTITY_REF_TYPE_MAP[entityName] || 0
  const refIdString = currentId ? String(currentId) : ""

  const uploadFile = useCallback(
    (file: File) => documentService.create({ refId: refIdString, refType, fileData: file }),
    [refIdString, refType],
  )

  const loadExisting = useCallback(() => documentService.getByRef(refIdString, refType), [refIdString, refType])

  if (!currentId) {
    return (
      <FormItem className="space-y-2 opacity-60 grayscale cursor-not-allowed">
        {label && <Label>{label}</Label>}
        <div className="p-8 border-2 border-dashed rounded-lg text-center bg-muted/20">
          <p className="text-sm text-muted-foreground">Please save the {entityName} first to enable image upload.</p>
        </div>
      </FormItem>
    )
  }

  return (
    <FormItem className="space-y-2">
      {label && <Label>{label}</Label>}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <FileUploader
        uploadFile={uploadFile}
        loadExisting={loadExisting}
        accept={accept}
        maxSize={maxSize}
        maxFiles={maxFiles}
        multiple={multiple}
        enableCrop={true}
      />
      <FormMessage />
    </FormItem>
  )
}
