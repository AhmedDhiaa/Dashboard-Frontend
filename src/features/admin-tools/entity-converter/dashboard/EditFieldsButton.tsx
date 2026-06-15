"use client"

/**
 * Convert-action button + confirmation dialog. The smallest possible
 * client leaf so the rest of /admin/entities stays in inert HTML.
 *
 * UX flow:
 *   1. Click "Edit fields" → confirmation Dialog opens
 *   2. Click "Continue" → useTransition pending state on the button,
 *      Server Action fires
 *   3a. Success → router.push(redirectTo) — server already revalidatePath'd
 *       so the destination's data is fresh
 *   3b. Refusal → useNotification.error(reason); dialog stays open so the
 *       user can read the reason next to the entity they tried to convert
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/design-system/primitives/dialog"
import { useNotification } from "@/ui/application"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"

/**
 * Shape of the Server Action's return value. We type the prop against this
 * structural shape rather than importing the action directly — domain-
 * boundary lint blocks `@/features/admin-tools/...` from importing
 * `@/app/...`. The page lifts the action import and passes it down here.
 */
export interface ConvertActionResult {
  ok: boolean
  reason?: string
  redirectTo?: string
  /**
   * On success, source files removed during the convert flow. The
   * unified post-save toast adds 1 (for the new runtime-config write)
   * to this count. Absent on refusal/failure.
   */
  deletedFiles?: readonly string[]
}

export type ConvertActionFn = (entityName: string) => Promise<ConvertActionResult>

export interface EditFieldsButtonProps {
  entityName: string
  /** Server Action injected from the page (kept out of this file's imports
   *  to satisfy the @/app boundary rule from @/features/admin-tools). */
  action: ConvertActionFn
}

export function EditFieldsButton({ entityName, action }: EditFieldsButtonProps): React.ReactNode {
  const router = useRouter()
  const notifications = useNotification()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleConfirm = (): void => {
    startTransition(async () => {
      const result = await action(entityName)
      if (result.ok && result.redirectTo) {
        // Convert deletes N source files + writes 1 runtime config entry.
        // Toast fires BEFORE the navigation; react-hot-toast survives
        // the route change so the admin lands on /builder with the
        // "review in Git Bridge" cue still visible.
        const fileCount = (result.deletedFiles?.length ?? 0) + 1
        notifySourceWrite(notifications, fileCount, router)
        setOpen(false)
        router.push(result.redirectTo)
        return
      }
      // Refusal: surface the reason as a plain string. useNotification's
      // string overload renders the message verbatim when it doesn't
      // contain a translation-key dot path.
      notifications.error(result.reason ?? "Convert failed")
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        Edit fields
      </Button>
      <Dialog open={open} onOpenChange={value => !pending && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert &quot;{entityName}&quot; to a runtime entity</DialogTitle>
            <DialogDescription>
              Move <code className="font-mono text-xs">{entityName}</code> from source files into the runtime store. The
              3 source files will be deleted. A backup is kept under{" "}
              <code className="font-mono text-xs">.entity-builder-backups/</code> and can be restored. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? "Converting…" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
