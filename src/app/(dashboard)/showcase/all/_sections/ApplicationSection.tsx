"use client"

/**
 * ApplicationSection — higher-level application widgets.
 *
 * Covered: ImageUploader (single-image, no-op handlers), FileUploader
 * (multi-file with stubbed upload), file-preview component for an existing
 * file URL, image-crop-dialog trigger (the real dialog requires a live
 * File object which is awkward to fabricate in a static showcase — we
 * describe the entry-point instead), and FilterMultiSelectField (real
 * one depends on useEnum + filter-config types; a placeholder is shown).
 */

import { useState } from "react"
import { Check, ImageIcon } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { FileUploader } from "@/ui/application/file-uploader"
import { ImageUploader } from "@/ui/application/ImageUploader"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

export default function ApplicationSection() {
  return (
    <div className="space-y-6">
      <ImageUploaderBlock />
      <FileUploaderBlock />
      <ImageCropTriggerBlock />
      <FilterMultiSelectBlock />
    </div>
  )
}

function ImageUploaderBlock() {
  const [image, setImage] = useState<File | undefined>(undefined)
  return (
    <ShowcaseBlock title="ImageUploader" description="Single-image upload with drag-and-drop, preview, optional crop.">
      <ImageUploader value={image} onChange={setImage} onRemove={() => setImage(undefined)} maxSizeKB={2048} />
    </ShowcaseBlock>
  )
}

function FileUploaderBlock() {
  // Stub uploader — pretends to upload and returns a synthetic id so the
  // showcase can mount the component without a backend. Real callers would
  // POST to /api/attachments / etc. and return the persisted id.
  const stubUpload = async (file: File) => {
    await new Promise(r => setTimeout(r, 400))
    return { id: `mock-${file.name}` }
  }
  return (
    <ShowcaseBlock title="FileUploader" description="Multi-file with drag-and-drop, validation, and inline progress.">
      <FileUploader uploadFile={stubUpload} accept="image/*,application/pdf" multiple maxFiles={5} />
    </ShowcaseBlock>
  )
}

function ImageCropTriggerBlock() {
  return (
    <ShowcaseBlock
      title="ImageCropDialog (entry-point)"
      description="The real dialog opens with an in-flight File object. Showcase shows the trigger only."
    >
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled>
          <ImageIcon className="h-4 w-4" />
          Open crop dialog (needs a File)
        </Button>
        <span className="text-xs text-muted-foreground">
          Trigger this from inside ImageUploader (above) by uploading an image and clicking the Crop icon.
        </span>
      </div>
    </ShowcaseBlock>
  )
}

function FilterMultiSelectBlock() {
  return (
    <ShowcaseBlock
      title="FilterMultiSelectField"
      description="The real component takes a FilterField + useEnum binding; showcase displays the rendered shape."
    >
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm">
        <span className="font-mono text-xs">FilterMultiSelectField</span>
        <span className="text-muted-foreground">
          → behaves like a Popover-anchored multi-select; selected values render as removable Badges with a{" "}
          <Check className="inline h-3 w-3" /> on each chosen option.
        </span>
      </div>
    </ShowcaseBlock>
  )
}
