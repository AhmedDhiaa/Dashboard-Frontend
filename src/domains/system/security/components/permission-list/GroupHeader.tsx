"use client"

import { memo } from "react"
import { CheckCircle2, MinusCircle } from "lucide-react"
import { PermissionGroupDto } from "@/shared/types/security.types"
import { Button } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"

export const GroupHeader = memo(function GroupHeader({
  group,
  permissions,
  onSetAll,
  t,
}: {
  group: PermissionGroupDto
  permissions: Record<string, boolean>
  onSetAll: (group: PermissionGroupDto, value: boolean) => void
  t: (key: string) => string
}) {
  const grantedCount = group.permissions.filter(p => permissions[p.name]).length
  const totalCount = group.permissions.length
  const allGranted = grantedCount === totalCount
  const noneGranted = grantedCount === 0
  const percent = totalCount > 0 ? Math.round((grantedCount / totalCount) * 100) : 0

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            allGranted ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm">{group.displayName}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium tabular-nums">
              {grantedCount} / {totalCount} {t("common.granted") || "granted"}
            </span>
            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-primary"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="font-semibold text-primary tabular-nums">{percent}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={noneGranted}
          onClick={() => onSetAll(group, false)}
          className="h-7 text-[10px] font-medium text-muted-foreground hover:text-destructive px-2.5 rounded-md"
        >
          <MinusCircle className="h-3 w-3 me-1" />
          {t("common.revokeAll") || "Revoke All"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={allGranted}
          onClick={() => onSetAll(group, true)}
          className="h-7 text-[10px] font-medium border-primary/20 hover:bg-primary/10 hover:text-primary px-2.5 rounded-md"
        >
          <CheckCircle2 className="h-3 w-3 me-1" />
          {t("common.grantAll") || "Grant All"}
        </Button>
      </div>
    </div>
  )
})
