"use client"

import { memo } from "react"
import { Zap } from "lucide-react"
import { PermissionDto } from "@/shared/types/security.types"
import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { cn } from "@/shared/utils"
import { cleanDisplayName } from "./utils"

export const SimplePermissionRow = memo(function SimplePermissionRow({
  root,
  isGranted,
  onToggle,
}: {
  root: PermissionDto
  isGranted: boolean
  onToggle: (name: string, checked: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 bg-card border border-border/40 rounded-xl transition-all hover:border-border/80",
        isGranted && "border-primary/15 bg-primary/2",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            isGranted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">{cleanDisplayName(root.displayName)}</span>
          <span className="text-[9px] font-mono text-muted-foreground/40 truncate">{root.name}</span>
        </div>
      </div>
      <Checkbox
        checked={isGranted}
        onCheckedChange={checked => onToggle(root.name, !!checked)}
        className="h-5 w-5 rounded-md shrink-0"
      />
    </div>
  )
})
