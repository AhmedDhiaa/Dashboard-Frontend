/**
 * File Utilities
 * Helper functions for file handling, validation, and formatting
 */

import { FileText, FileSpreadsheet, File as FileIcon, Image, FileVideo, FileAudio, Archive } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Validate file type against accept string
 */
export function validateFileType(file: File, accept?: string): boolean {
  if (!accept) return true

  const acceptTypes = accept.split(",").map(t => t.trim())
  const fileType = file.type
  const fileName = file.name.toLowerCase()

  return acceptTypes.some(acceptType => {
    // Handle wildcards (e.g., "image/*")
    if (acceptType.includes("*")) {
      const baseType = acceptType.split("/")[0]
      return fileType.startsWith(baseType + "/")
    }

    // Handle extensions (e.g., ".pdf")
    if (acceptType.startsWith(".")) {
      return fileName.endsWith(acceptType.toLowerCase())
    }

    // Handle MIME types (e.g., "application/pdf")
    return fileType === acceptType
  })
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSize?: number): boolean {
  if (!maxSize) return true
  return file.size <= maxSize
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".")
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? "") : ""
}

/**
 * Get file icon based on file type
 */
export function getFileIcon(filename: string): LucideIcon {
  const ext = getFileExtension(filename)

  // Documents
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) {
    return FileText
  }

  // Spreadsheets
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return FileSpreadsheet
  }

  // Images
  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) {
    return Image
  }

  // Videos
  if (["mp4", "avi", "mov", "wmv", "flv", "mkv"].includes(ext)) {
    return FileVideo
  }

  // Audio
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
    return FileAudio
  }

  // Archives
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return Archive
  }

  return FileIcon
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

/**
 * Download file from URL
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(objectUrl)
}
