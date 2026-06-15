/**
 * Image Validation Utilities
 * Extracted from ImageUploader to reduce complexity
 * Strategy Pattern for different validation checks
 */

interface ValidationResult {
  isValid: boolean
  errorKey?: string
  errorParams?: Record<string, string>
}

interface ImageDimensions {
  width: number
  height: number
}

/**
 * Validate image format
 */
export function validateImageFormat(file: File, acceptedFormats: string[]): ValidationResult {
  if (!acceptedFormats.includes(file.type)) {
    return {
      isValid: false,
      errorKey: "uploader.invalid_format",
      errorParams: { formats: acceptedFormats.join(", ") },
    }
  }
  return { isValid: true }
}

/**
 * Validate file size
 */
export function validateImageSize(file: File, maxSizeKB: number): ValidationResult {
  const sizeKB = file.size / 1024
  if (sizeKB > maxSizeKB) {
    return {
      isValid: false,
      errorKey: "uploader.file_too_large",
      errorParams: { size: maxSizeKB.toString() },
    }
  }
  return { isValid: true }
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  dimensions: ImageDimensions,
  constraints: {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
  },
): ValidationResult {
  const { width, height } = dimensions
  const { minWidth, minHeight, maxWidth, maxHeight } = constraints

  if (minWidth && width < minWidth) {
    return {
      isValid: false,
      errorKey: "uploader.width_too_small",
      errorParams: { width: minWidth.toString() },
    }
  }

  if (minHeight && height < minHeight) {
    return {
      isValid: false,
      errorKey: "uploader.height_too_small",
      errorParams: { height: minHeight.toString() },
    }
  }

  if (maxWidth && width > maxWidth) {
    return {
      isValid: false,
      errorKey: "uploader.width_too_large",
      errorParams: { width: maxWidth.toString() },
    }
  }

  if (maxHeight && height > maxHeight) {
    return {
      isValid: false,
      errorKey: "uploader.height_too_large",
      errorParams: { height: maxHeight.toString() },
    }
  }

  return { isValid: true }
}

/**
 * Load image dimensions from file
 */
export function loadImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()

    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error("Failed to load image"))
    }

    img.src = URL.createObjectURL(file)
  })
}
