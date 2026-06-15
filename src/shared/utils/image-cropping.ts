/**
 * Image Cropping Utilities
 * Extracted from ImageUploader to reduce complexity
 */

import type { Area } from "react-easy-crop"

/**
 * Load image from data URL
 */
async function loadImage(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const image = new window.Image()
    image.src = imageSrc
    image.onload = () => resolve(image)
  })
}

/**
 * Create cropped image file from original image and crop area
 */
export async function createCroppedImageFile(
  imageSrc: string,
  croppedAreaPixels: Area,
  rotation: number = 0,
): Promise<File> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Failed to get canvas context")
  }

  const { width, height, x, y } = croppedAreaPixels

  canvas.width = width
  canvas.height = height

  // Apply rotation
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-canvas.width / 2, -canvas.height / 2)

  // Draw cropped area
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height)

  ctx.restore()

  // Convert canvas to File
  return new Promise<File>(resolve => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          throw new Error("Failed to create blob from canvas")
        }
        const file = new File([blob], "cropped-image.jpg", { type: "image/jpeg" })
        resolve(file)
      },
      "image/jpeg",
      0.95,
    )
  })
}

/**
 * Convert File to data URL for preview
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.readAsDataURL(file)
  })
}
