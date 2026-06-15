"use client"

/**
 * Toggle button intended for the header user dropdown. Renders nothing if
 * the user isn't a translation admin so non-admins don't see the menu item.
 */

import { Pencil } from "lucide-react"
import { DropdownMenuItem } from "@/ui/design-system/primitives/dropdown-menu"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { cn } from "@/shared/utils"
import { useTranslationEditor } from "../TranslationEditorContext"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

const MANAGE_PERMISSION = PERMISSIONS.TRANSLATION_MANAGE

export function EditModeToggle({ className }: { className?: string }): React.ReactNode {
  const { enabled, toggle } = useTranslationEditor()
  const { isAdmin, isGranted } = usePermissionContext()

  if (!isAdmin && !isGranted(MANAGE_PERMISSION)) return null

  return (
    <DropdownMenuItem
      onSelect={e => {
        e.preventDefault()
        toggle()
      }}
      className={cn("gap-2 hover:bg-muted", className)}
    >
      <Pencil className={cn("h-3.5 w-3.5", enabled && "text-primary")} />
      <span>{enabled ? "Translation Edit Mode: ON" : "Translation Edit Mode"}</span>
    </DropdownMenuItem>
  )
}
