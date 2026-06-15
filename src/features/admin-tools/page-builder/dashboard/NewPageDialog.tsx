"use client"

/**
 * "New page" dialog. Collects a localized title + a kebab-case page id
 * (auto-slugged from the English title, editable), then POSTs a blank
 * valid `PageSchema` through the create endpoint. On success it hands the
 * new id back to the caller, which routes into the canvas editor.
 *
 * Creating the page server-side FIRST (rather than dropping into a canvas
 * with a throwaway "draft-page" id) is what makes the lifecycle work: every
 * page exists under a real id from the moment it's created, so subsequent
 * canvas saves PUT to that id and the page is immediately listable/editable.
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/design-system/primitives/dialog"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Button } from "@/ui/design-system/primitives/button"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { slugify } from "@/shared/utils/general"
import { createPage } from "./api"
import type { PageSchema } from "../schema/page-schema"

// Mirrors `kebabIdSchema` in schema/field-schema.ts.
const ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/

export interface NewPageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (pageId: string) => void
}

export function NewPageDialog({ open, onOpenChange, onCreated }: NewPageDialogProps): React.ReactNode {
  const [titleEn, setTitleEn] = useState("")
  const [titleAr, setTitleAr] = useState("")
  const [idOverride, setIdOverride] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pageId = idOverride ?? slugify(titleEn, 41)
  const idValid = ID_PATTERN.test(pageId)
  const canCreate = titleEn.trim().length > 0 && idValid && !busy

  const handleCreate = async () => {
    setBusy(true)
    setError(null)
    const schema: PageSchema = {
      id: pageId,
      version: "1.0",
      title: { en: titleEn.trim(), ar: titleAr.trim() || titleEn.trim() },
      permission: PERMISSIONS.ADMIN_PAGE_BUILDER,
      layout: "full",
      blocks: [],
    }
    try {
      const page = await createPage(schema)
      setTitleEn("")
      setTitleAr("")
      setIdOverride(null)
      onOpenChange(false)
      onCreated(page.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>Give the page a name. You can add blocks to it next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field id="np-title-en" label="Title (English)">
            <Input
              id="np-title-en"
              value={titleEn}
              onChange={e => setTitleEn(e.target.value)}
              placeholder="Orders overview"
              autoFocus
            />
          </Field>
          <Field id="np-title-ar" label="Title (Arabic)">
            <Input
              id="np-title-ar"
              value={titleAr}
              onChange={e => setTitleAr(e.target.value)}
              placeholder="نظرة عامة على الطلبات"
              dir="rtl"
            />
          </Field>
          <Field id="np-id" label="Page ID" hint={`URL: /pages/${pageId || "your-id"}`}>
            <Input
              id="np-id"
              value={pageId}
              onChange={e => setIdOverride(e.target.value)}
              placeholder="orders-overview"
              className="font-mono"
            />
            {!idValid && titleEn.length > 0 && (
              <p className="text-xs text-destructive">Use kebab-case: start with a letter, 2–41 chars (a–z, 0–9, -).</p>
            )}
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {busy ? "Creating…" : "Create & edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
