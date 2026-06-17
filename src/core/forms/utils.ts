/**
 * Form Utilities and Validators
 * Client-side and server-side validation rules, formatters, and helpers
 */

import type { ValidationError } from "@/shared/types"
// Single source of truth lives in shared/utils/file.ts; re-exported here so
// existing `@/core/forms/utils` importers keep working.
import { formatFileSize } from "@/shared/utils/file"

export { formatFileSize }

/**
 * Validate File Upload
 */
export function validateFileUpload(file: File, maxSize?: number, acceptedTypes?: string[]): string | null {
  // Check file size
  if (maxSize && file.size > maxSize) {
    return `File size must not exceed ${formatFileSize(maxSize)}`
  }

  // Check file type
  if (acceptedTypes && acceptedTypes.length > 0) {
    const isAccepted = acceptedTypes.some(type => {
      if (type === "*/*") return true
      if (type.endsWith("/*")) {
        const prefix = type.split("/")[0]
        if (!prefix) return false
        const fileType = file.type || ""
        return fileType.startsWith(prefix)
      }
      return file.type === type
    })

    if (!isAccepted) {
      return `File type not accepted. Accepted types: ${acceptedTypes.join(", ")}`
    }
  }

  return null
}

/**
 * Map server-side errors to form field errors
 */
export function mapServerErrors(
  serverErrors: Record<string, string[]> | string | ValidationError[] | undefined,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  if (!serverErrors) {
    return errors
  }

  // Handle array of validation errors
  if (Array.isArray(serverErrors)) {
    serverErrors.forEach(error => {
      if (!errors[error.field]) {
        errors[error.field] = []
      }
      errors[error.field]?.push(error.message)
    })
    return errors
  }

  // Handle string error (general error)
  if (typeof serverErrors === "string") {
    errors["_general"] = [serverErrors]
    return errors
  }

  // Handle object of errors
  return serverErrors
}
