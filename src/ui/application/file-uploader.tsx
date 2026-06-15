/**
 * Universal File Uploader Component
 * Supports images and documents with drag & drop, preview, crop, and multi-file upload
 */

"use client"

import { useState, useCallback, useEffect } from "react"
import { logger } from "@/shared/logger"
import { useDropzone } from "react-dropzone"
import { Upload, X, File as FileIcon, Loader2 } from "lucide-react"
import Image from "next/image"
import { cn } from "@/shared/utils"
import { Button } from "@/ui/design-system/primitives/button"
import { Card } from "@/ui/design-system/primitives/card"
import { useNotification } from "@/ui/application"
import { validateFileType, validateFileSize, formatFileSize, isImageFile } from "@/shared/utils"
import { FilePreview } from "./file-preview"
import { ImageCropDialog } from "./image-crop-dialog"

export interface FileUploaderProps {
  /** Upload a single file. Returns the persisted file's id. */
  uploadFile: (file: File) => Promise<{ id: string }>
  /** Optional: load already-uploaded files for this attachment slot. */
  loadExisting?: () => Promise<{ id: string }[]>
  /** Accepted file types (e.g., "image/*,application/pdf") */
  accept?: string
  /** Maximum file size in bytes */
  maxSize?: number
  /** Maximum number of files */
  maxFiles?: number
  /** Allow multiple file selection */
  multiple?: boolean
  /** Callback when upload completes */
  onUploadComplete?: (urls: string[]) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Pre-loaded file URLs */
  initialFiles?: string[]
  /** Disable upload */
  disabled?: boolean
  /** Auto-compress images */
  autoCompress?: boolean
  /** Show crop dialog for images */
  enableCrop?: boolean
  /** Custom className */
  className?: string
}

interface UploadingFile {
  file: File
  id: string
  progress: number
  error?: string
  preview?: string
}

// eslint-disable-next-line complexity, max-lines-per-function -- Complex file upload with validation, preview, cropping, and state management
export function FileUploader({
  uploadFile,
  loadExisting,
  accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx",
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  multiple = true,
  initialFiles = [],
  disabled = false,
  enableCrop = true,
  className,
}: FileUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(initialFiles)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [cropImage, setCropImage] = useState<{ file: File; id: string } | null>(null)
  const notifi = useNotification()

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const newUploadingFiles: UploadingFile[] = files.map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        progress: 0,
        preview: isImageFile(file) ? URL.createObjectURL(file) : undefined,
      }))

      setUploadingFiles(prev => [...prev, ...newUploadingFiles])

      for (const uploadingFile of newUploadingFiles) {
        try {
          const result = await uploadFile(uploadingFile.file)

          setUploadingFiles(prev => prev.filter(f => f.id !== uploadingFile.id))
          setUploadedFiles(prev => [...prev, result.id])

          if (uploadingFile.preview) {
            URL.revokeObjectURL(uploadingFile.preview)
          }

          notifi.success(`File ${uploadingFile.file.name} uploaded successfully`)
        } catch (err) {
          logger.error(`Failed to upload ${uploadingFile.file.name}:`, err)
          setUploadingFiles(prev =>
            prev.map(f => (f.id === uploadingFile.id ? { ...f, error: "Upload failed", progress: 0 } : f)),
          )
          notifi.error(`Failed to upload ${uploadingFile.file.name}`)
        }
      }
    },
    [uploadFile, notifi],
  )

  // Load existing files on mount
  useEffect(() => {
    if (!loadExisting) return
    loadExisting()
      .then(files => setUploadedFiles(files.map(f => f.id)))
      .catch(error => logger.error("Failed to load existing files:", error))
  }, [loadExisting])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return

      // Validate file count
      const totalFiles = uploadedFiles.length + uploadingFiles.length + acceptedFiles.length
      if (totalFiles > maxFiles) {
        notifi.error(`Maximum ${maxFiles} files allowed`)
        return
      }

      // Validate and process files
      const validFiles: File[] = []

      for (const file of acceptedFiles) {
        // Validate type
        if (!validateFileType(file, accept)) {
          notifi.error(`Invalid file type: ${file.name}`)
          continue
        }

        // Validate size
        if (!validateFileSize(file, maxSize)) {
          notifi.error(`File too large: ${file.name} (max ${formatFileSize(maxSize)})`)
          continue
        }

        validFiles.push(file)
      }

      if (validFiles.length === 0) return

      // Check if image needs cropping
      if (enableCrop && validFiles.length === 1 && validFiles[0] && isImageFile(validFiles[0])) {
        const fileId = Math.random().toString(36).substring(7)
        setCropImage({ file: validFiles[0], id: fileId })
        return
      }

      // Upload files
      await uploadFiles(validFiles)
    },
    [disabled, uploadedFiles, uploadingFiles, maxFiles, accept, maxSize, enableCrop, notifi, uploadFiles],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept
      ? accept.split(",").reduce(
          (acc, type) => {
            acc[type.trim()] = []
            return acc
          },
          {} as Record<string, string[]>,
        )
      : undefined,
    maxSize,
    multiple,
    disabled,
  })

  const handleCropComplete = async (croppedFile: File) => {
    if (!cropImage) return

    setCropImage(null)
    await uploadFiles([croppedFile])
  }

  const handleCropCancel = () => {
    setCropImage(null)
  }

  const handleRemoveFile = async (url: string) => {
    try {
      // Extract document ID from URL if needed
      // For now, just remove from local state
      setUploadedFiles(prev => prev.filter(f => f !== url))
      notifi.success("File removed")
    } catch (error) {
      logger.error("Failed to remove file:", error)
      notifi.error("Failed to remove file")
    }
  }

  const handleCancelUpload = (id: string) => {
    setUploadingFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.preview) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  const canUploadMore = uploadedFiles.length + uploadingFiles.length < maxFiles

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      {canUploadMore && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
            isDragActive ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{isDragActive ? "Drop files here" : "Drag & drop files here"}</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse ({formatFileSize(maxSize)} max)</p>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map(file => (
            <Card key={file.id} className="p-4">
              <div className="flex items-center gap-3">
                {file.preview ? (
                  <div className="relative w-12 h-12 rounded overflow-hidden">
                    <Image src={file.preview} alt={file.file.name} fill className="object-cover" sizes="48px" />
                  </div>
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-muted rounded">
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
                  {file.error ? (
                    <p className="text-xs text-red-500 mt-1">{file.error}</p>
                  ) : (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {file.progress < 100 && !file.error && (
                  <Button variant="ghost" size="icon" onClick={() => handleCancelUpload(file.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {file.progress === 100 && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploadedFiles.map((url, index) => (
            <FilePreview key={index} url={url} onRemove={() => handleRemoveFile(url)} />
          ))}
        </div>
      )}

      {/* Image Crop Dialog */}
      {cropImage && (
        <ImageCropDialog
          file={cropImage.file}
          open={!!cropImage}
          onOpenChange={open => !open && handleCropCancel()}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}
