"use client"

/**
 * Inverse-of-convert affordance, surfaced from EntityTable on runtime
 * rows that have a paired convert backup. Mirrors EditFieldsButton:
 * single button → confirmation Dialog → useTransition fires the Server
 * Action → success toast + router.refresh.
 *
 * The Server Action is passed in as a prop because @/features cannot
 * import from @/app (domain-boundary lint, same constraint that
 * shaped EditFieldsButton in Part 2).
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
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

export interface RestoreActionResult {
  ok: boolean
  reason?: string
  restoredFiles?: readonly string[]
  safetyBackupId?: string
}

export type RestoreActionFn = (entityName: string, backupId: string) => Promise<RestoreActionResult>

export interface RestoreConvertButtonProps {
  entityName: string
  backupId: string
  action: RestoreActionFn
}

export function RestoreConvertButton({ entityName, backupId, action }: RestoreConvertButtonProps): React.ReactNode {
  const router = useRouter()
  const notifications = useNotification()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleConfirm = (): void => {
    startTransition(async () => {
      const result = await action(entityName, backupId)
      if (result.ok) {
        // Count = restored files + 1 (the runtime config write removed).
        const fileCount = (result.restoredFiles?.length ?? 0) + 1
        notifySourceWrite(notifications, fileCount, router)
        setOpen(false)
        // The Server Action already calls revalidatePath; router.refresh
        // re-fetches the RSC tree for /admin/entities so the row flips
        // back from "runtime" to "static + convertible".
        router.refresh()
        return
      }
      notifications.error(result.reason ?? "Restore failed")
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="text-xs gap-1"
        title={`Restore ${entityName} from snapshot ${backupId}`}
      >
        <RotateCcw className="h-3 w-3" />
        Restore from source
      </Button>
      <Dialog open={open} onOpenChange={value => !pending && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore &quot;{entityName}&quot; from source</DialogTitle>
            <DialogDescription>
              The current runtime entity will be removed. The static{" "}
              <code className="font-mono text-xs">.config.tsx</code> +{" "}
              <code className="font-mono text-xs">.schema.ts</code> +{" "}
              <code className="font-mono text-xs">.types.ts</code> will return to disk from snapshot{" "}
              <code className="font-mono text-xs">{backupId}</code>. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? "Restoring…" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
