"use client"

import { useState, useCallback, useRef, memo } from "react"
import Image from "next/image"
import nextDynamic from "next/dynamic"
import type CropperT from "react-easy-crop"
import type { Point, Area } from "react-easy-crop"
import { Upload, X, Crop, RotateCw, ZoomIn, Check } from "lucide-react"

// Heavy lib (~30 KB gz). Loaded only when the user clicks Crop and the
// dialog mounts the Cropper — keeps the uploader's idle weight near zero.
// Cast preserves the original prop optionality from defaultProps.
const Cropper = nextDynamic(() => import("react-easy-crop"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
}) as unknown as typeof CropperT
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/design-system/primitives/dialog"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Slider } from "@/ui/design-system/primitives/slider"
import { cn } from "@/shared/utils"
import { useNotification } from "@/ui/application"
import { useT } from "@/shared/config"
import { validateImageFormat, validateImageSize, validateImageDimensions, loadImageDimensions } from "@/shared/utils"
import { createCroppedImageFile, fileToDataURL } from "@/shared/utils"

interface ImageUploaderProps {
  value?: File | string
  onChange: (file: File) => void
  onRemove?: () => void
  maxWidth?: number
  maxHeight?: number
  minWidth?: number
  minHeight?: number
  aspectRatio?: number
  maxSizeKB?: number
  acceptedFormats?: string[]
  className?: string
  disabled?: boolean
  showPreview?: boolean
  showCrop?: boolean
  showResolution?: boolean
}

// eslint-disable-next-line complexity, max-lines-per-function -- Complex image uploader with validation, preview, cropping, and drag-and-drop
export const ImageUploader = memo<ImageUploaderProps>(function ImageUploader({
  value,
  onChange,
  onRemove,
  maxWidth,
  maxHeight,
  minWidth,
  minHeight,
  aspectRatio,
  maxSizeKB = 5120, // 5MB default
  acceptedFormats = ["image/jpeg", "image/png", "image/webp"],
  className,
  disabled = false,
  showPreview = true,
  showCrop = true,
  showResolution = true,
}: ImageUploaderProps) {
  const t = useT("common")
  const notifications = useNotification()
  const [imagePreview, setImagePreview] = useState<string | null>(typeof value === "string" ? value : null)
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateImage = useCallback(
    async (file: File): Promise<boolean> => {
      // Validate format
      const formatResult = validateImageFormat(file, acceptedFormats)
      if (!formatResult.isValid) {
        notifications.info(formatResult.errorKey!, formatResult.errorParams)
        return false
      }

      // Validate size
      const sizeResult = validateImageSize(file, maxSizeKB)
      if (!sizeResult.isValid) {
        notifications.info(sizeResult.errorKey!, sizeResult.errorParams)
        return false
      }

      // Load and validate dimensions
      try {
        const dimensions = await loadImageDimensions(file)
        setImageDimensions(dimensions)

        const dimensionsResult = validateImageDimensions(dimensions, {
          minWidth,
          minHeight,
          maxWidth,
          maxHeight,
        })

        if (!dimensionsResult.isValid) {
          notifications.info(dimensionsResult.errorKey!, dimensionsResult.errorParams)
          return false
        }

        return true
      } catch {
        notifications.error("uploader.failed_to_load")
        return false
      }
    },
    [acceptedFormats, maxSizeKB, minWidth, minHeight, maxWidth, maxHeight, notifications],
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isValid = await validateImage(file)
    if (!isValid) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setOriginalImage(result)
      setImagePreview(result)

      if (showCrop) {
        setCropDialogOpen(true)
      } else {
        onChange(file)
      }
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropSave = useCallback(async () => {
    if (!originalImage || !croppedAreaPixels) return

    try {
      const croppedFile = await createCroppedImageFile(originalImage, croppedAreaPixels, rotation)
      const preview = await fileToDataURL(croppedFile)
      setImagePreview(preview)
      onChange(croppedFile)
      setCropDialogOpen(false)
      notifications.success("uploader.crop_success")
    } catch {
      notifications.error("uploader.crop_failed")
    }
  }, [originalImage, croppedAreaPixels, rotation, onChange, notifications])

  const handleRemove = () => {
    setImagePreview(null)
    setOriginalImage(null)
    setImageDimensions(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onRemove?.()
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(",")}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
            id="image-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-full border-border hover:bg-muted"
          >
            <Upload className="me-2 h-4 w-4" />
            {t("image_uploader.upload")}
          </Button>
        </div>

        {showResolution && (
          <div className="text-xs text-muted-foreground space-y-1">
            {minWidth && minHeight && (
              <div>
                {t("image_uploader.min_label")} {minWidth}x{minHeight}px
              </div>
            )}
            {maxWidth && maxHeight && (
              <div>
                {t("image_uploader.max_label")} {maxWidth}x{maxHeight}px
              </div>
            )}
            {aspectRatio && (
              <div>
                {t("image_uploader.aspect_ratio")} {aspectRatio}:1
              </div>
            )}
            <div>
              {t("image_uploader.max_size")} {maxSizeKB}KB
            </div>
            <div>
              {t("image_uploader.formats")} {acceptedFormats.join(", ")}
            </div>
          </div>
        )}

        {showPreview && imagePreview && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="relative group h-image-preview">
                <Image
                  src={imagePreview}
                  alt={t("messages.image_preview_alt")}
                  fill
                  className="object-contain rounded-lg"
                  sizes="(max-width: 768px) 100vw, 600px"
                />
                <div className="absolute top-2 end-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {showCrop && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => setCropDialogOpen(true)}
                      className="bg-muted hover:bg-muted/80"
                    >
                      <Crop className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="destructive" onClick={handleRemove}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {imageDimensions && (
                  <div className="absolute bottom-2 start-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {imageDimensions.width} x {imageDimensions.height}px
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("image_uploader.crop_title")}</DialogTitle>
            <DialogDescription>{t("image_uploader.crop_description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="relative h-image-preview-large bg-muted rounded-lg overflow-hidden">
              {originalImage && (
                <Cropper
                  image={originalImage}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspectRatio || 1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  {t("image_uploader.zoom")} {zoom.toFixed(2)}x
                </Label>
                <Slider
                  value={[zoom]}
                  onValueChange={values => setZoom(values[0] ?? 1)}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <RotateCw className="h-4 w-4" />
                  {t("image_uploader.rotation")} {rotation}°
                </Label>
                <Slider
                  value={[rotation]}
                  onValueChange={values => setRotation(values[0] ?? 0)}
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCropDialogOpen(false)}
              className="border-border hover:bg-muted"
            >
              {t("cancel")}
            </Button>
            <Button type="button" onClick={handleCropSave} variant="primary">
              <Check className="me-2 h-4 w-4" />
              {t("image_uploader.apply_crop")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})

ImageUploader.displayName = "ImageUploader"
