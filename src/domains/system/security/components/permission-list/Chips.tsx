"use client"

import { memo } from "react"
import { PermissionDto } from "@/shared/types/security.types"
import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { cn } from "@/shared/utils"
import { cleanDisplayName } from "./utils"

export const SubActionChip = memo(function SubActionChip({
  sub,
  isGranted,
  onToggle,
}: {
  sub: PermissionDto
  isGranted: boolean
  onToggle: (name: string, checked: boolean) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(sub.name, !isGranted)}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle(sub.name, !isGranted)
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all select-none cursor-pointer",
        isGranted
          ? "bg-primary/80 text-primary-foreground border-primary/60 shadow-sm"
          : "bg-background border-border/40 text-muted-foreground/70 hover:border-primary/30 hover:text-primary hover:bg-primary/5",
      )}
    >
      <Checkbox
        checked={isGranted}
        className="h-2.5 w-2.5 pointer-events-none border-current data-[state=checked]:bg-transparent data-[state=checked]:text-current data-[state=checked]:border-current"
        tabIndex={-1}
      />
      {cleanDisplayName(sub.displayName)}
    </div>
  )
})

export const ActionChip = memo(function ActionChip({
  action,
  isGranted,
  subs,
  permissions,
  onToggle,
}: {
  action: PermissionDto
  isGranted: boolean
  subs: PermissionDto[] | undefined
  permissions: Record<string, boolean>
  onToggle: (name: string, checked: boolean) => void
}) {
  const hasSubs = subs && subs.length > 0

  return (
    <div className="flex flex-col gap-1">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(action.name, !isGranted)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle(action.name, !isGranted)
          }
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
          isGranted
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5",
        )}
      >
        <Checkbox
          checked={isGranted}
          className="h-3 w-3 pointer-events-none border-current data-[state=checked]:bg-transparent data-[state=checked]:text-current data-[state=checked]:border-current"
          tabIndex={-1}
        />
        {cleanDisplayName(action.displayName)}
      </div>
      {hasSubs && (
        <div className="flex flex-wrap gap-1 ps-3">
          {subs.map(sub => (
            <SubActionChip key={sub.name} sub={sub} isGranted={permissions[sub.name] || false} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
})

export const AttributeChip = memo(function AttributeChip({
  attr,
  isGranted,
  onToggle,
}: {
  attr: PermissionDto
  isGranted: boolean
  onToggle: (name: string, checked: boolean) => void
}) {
  const label = cleanDisplayName(attr.displayName)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(attr.name, !isGranted)}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle(attr.name, !isGranted)
        }
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-start transition-all cursor-pointer select-none",
        isGranted
          ? "bg-primary/8 border-primary/25 shadow-sm"
          : "bg-background border-border/40 hover:border-primary/30 hover:bg-primary/2",
      )}
    >
      <Checkbox
        checked={isGranted}
        className="h-3.5 w-3.5 pointer-events-none shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        tabIndex={-1}
      />
      <span className={cn("text-[11px] font-medium truncate", isGranted ? "text-primary" : "text-foreground")}>
        {label}
      </span>
    </div>
  )
})
