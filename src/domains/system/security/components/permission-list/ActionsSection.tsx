"use client"

import { memo } from "react"
import { Layers } from "lucide-react"
import { PermissionDto } from "@/shared/types/security.types"
import { cn } from "@/shared/utils"
import { ActionChip } from "./Chips"

export const ActionsSection = memo(function ActionsSection({
  actions,
  subActionMap,
  permissions,
  allActionsGranted,
  onToggle,
  onToggleAll,
}: {
  actions: PermissionDto[]
  subActionMap: Record<string, PermissionDto[]>
  permissions: Record<string, boolean>
  allActionsGranted: boolean
  onToggle: (name: string, checked: boolean) => void
  onToggleAll: (value: boolean) => void
}) {
  return (
    <div className="border-t border-border/20 px-4 py-3 bg-muted/3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <Layers className="h-3 w-3" />
          Actions
        </div>
        {actions.length > 1 && (
          <button
            type="button"
            onClick={() => onToggleAll(!allActionsGranted)}
            className={cn(
              "text-[9px] font-medium px-2 py-0.5 rounded transition-colors",
              allActionsGranted
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5",
            )}
          >
            {allActionsGranted ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map(action => (
          <ActionChip
            key={action.name}
            action={action}
            isGranted={permissions[action.name] || false}
            subs={subActionMap[action.name]}
            permissions={permissions}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
})
