/**
 * Image Crop Dialog Component
 * Allows users to crop, rotate, and adjust images before upload
 */

"use client"

import React, { useState, useCallback } from "react"
import nextDynamic from "next/dynamic"
import { logger } from "@/shared/logger"
import { useT } from "@/shared/config"
import type CropperT from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { RotateCw, Crop, ZoomIn } from "lucide-react"

// react-easy-crop is ~30 KB gz on its own; loading it dynamically keeps it
// out of the always-loaded `@/ui/application` barrel chain. The cropper
// only mounts when this dialog is actually opened. The cast preserves the
// original prop optionality (Cropper has many defaultProps the dynamic
// wrapper would otherwise mark required).
const Cropper = nextDynamic(() => import("react-easy-crop"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted animate-pulse" />,
}) as unknown as typeof CropperT
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/design-system/primitives/dialog"
import { Button } from "@/ui/design-system/primitives/button"
import { Slider } from "@/ui/design-system/primitives/slider"
import { Label } from "@/ui/design-system/primitives/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"

export interface ImageCropDialogProps {
  file: File
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropComplete: (croppedFile: File) => void
}

const ASPECT_RATIOS = [
  { label: "Free", value: 0 },
  { label: "1:1 (Square)", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
]

// eslint-disable-next-line max-lines-per-function -- Complex image cropping UI with zoom, rotation, aspect ratio, and canvas manipulation
export function ImageCropDialog({ file, open, onOpenChange, onCropComplete }: ImageCropDialogProps) {
  const t = useT("common")
  const [imageSrc, setImageSrc] = useState<string>("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Load image when file changes
  React.useEffect(() => {
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setImageSrc(reader.result as string)
      }
      reader.readAsDataURL(file)
    }

    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropAreaComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async (): Promise<Blob> => {
    if (!croppedAreaPixels) {
      throw new Error("No crop area defined")
    }

    return new Promise((resolve, reject) => {
      const image = new Image()
      image.src = imageSrc

      image.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }

        // Set canvas size to cropped area
        canvas.width = croppedAreaPixels.width
        canvas.height = croppedAreaPixels.height

        // Apply rotation
        if (rotation !== 0) {
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate((rotation * Math.PI) / 180)
          ctx.translate(-canvas.width / 2, -canvas.height / 2)
        }

        // Draw cropped image
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
        )

        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error("Failed to create blob"))
            return
          }
          resolve(blob)
        }, file.type)
      }

      image.onerror = () => reject(new Error("Failed to load image"))
    })
  }

  const handleSave = async () => {
    try {
      setIsProcessing(true)

      const croppedBlob = await createCroppedImage()
      const croppedFile = new File([croppedBlob], file.name, {
        type: file.type,
        lastModified: Date.now(),
      })

      onCropComplete(croppedFile)
      onOpenChange(false)
    } catch (error) {
      logger.error("Failed to crop image:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setAspect(0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            {t("image_uploader.crop_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div className="relative h-[400px] bg-muted rounded-lg overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect || undefined}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropAreaComplete}
              />
            )}
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label>{t("image_uploader.aspect_ratio")}</Label>
              <Select value={aspect.toString()} onValueChange={value => setAspect(parseFloat(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map(ratio => (
                    <SelectItem key={ratio.value} value={ratio.value.toString()}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <Label>{t("image_uploader.rotation")}</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleRotate} type="button">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
            </div>

            {/* Zoom */}
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                {t("image_uploader.zoom")}
              </Label>
              <Slider
                value={[zoom]}
                onValueChange={([value]) => value !== undefined && setZoom(value)}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset} type="button">
            {t("reset")}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isProcessing} type="button">
            {isProcessing ? t("processing") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
