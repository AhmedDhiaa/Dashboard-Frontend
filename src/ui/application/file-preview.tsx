/**
 * File Preview Component
 * Displays preview for uploaded files with actions
 */

"use client"

import { useState, useMemo, createElement } from "react"
import { logger } from "@/shared/logger"
import { X, Download, Eye } from "lucide-react"
import Image from "next/image"
import { Card } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"
import { getFileExtension, getFileIcon, downloadFile } from "@/shared/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/design-system/primitives/dialog"

export interface FilePreviewProps {
  url: string
  onRemove?: () => void
  className?: string
}

export function FilePreview({ url, onRemove, className }: FilePreviewProps) {
  const [showPreview, setShowPreview] = useState(false)

  const fileName = url.split("/").pop() || "file"
  const extension = getFileExtension(fileName)

  const isImage = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension)
  const isPDF = extension === "pdf"

  const handleDownload = async () => {
    try {
      await downloadFile(url, fileName)
    } catch (error) {
      logger.error("Download failed:", error)
    }
  }

  // Memoize icon to avoid creating component during render
  const Icon = useMemo(() => getFileIcon(fileName), [fileName])

  return (
    <>
      <Card className={cn("group relative overflow-hidden", className)}>
        {/* Preview */}
        <div className="aspect-square bg-muted flex items-center justify-center relative">
          {isImage ? (
            <Image
              src={url}
              alt={fileName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            createElement(Icon, { className: "h-12 w-12 text-muted-foreground" })
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {(isImage || isPDF) && (
              <Button variant="secondary" size="icon" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            {onRemove && (
              <Button variant="destructive" size="icon" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* File name */}
        <div className="p-2 bg-card">
          <p className="text-xs truncate" title={fileName}>
            {fileName}
          </p>
        </div>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{fileName}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {isImage && (
              <div className="relative w-full" style={{ minHeight: "400px" }}>
                <Image
                  src={url}
                  alt={fileName}
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}
            {isPDF && <iframe src={url} className="w-full h-[70vh] border-0" title={fileName} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
