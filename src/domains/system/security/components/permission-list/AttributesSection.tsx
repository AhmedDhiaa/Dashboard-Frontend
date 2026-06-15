"use client"

import { memo } from "react"
import { ChevronDown, ChevronUp, ToggleLeft } from "lucide-react"
import { PermissionDto } from "@/shared/types/security.types"
import { Badge } from "@/ui/design-system/primitives/badge"
import { cn } from "@/shared/utils"
import { AttributeChip } from "./Chips"

export const AttributesSection = memo(function AttributesSection({
  attributes,
  permissions,
  attrGrantedCount,
  allAttrGranted,
  someAttrGranted,
  showAttributes,
  onToggleShow,
  onToggle,
  onToggleAll,
}: {
  attributes: PermissionDto[]
  permissions: Record<string, boolean>
  attrGrantedCount: number
  allAttrGranted: boolean
  someAttrGranted: boolean
  showAttributes: boolean
  onToggleShow: () => void
  onToggle: (name: string, checked: boolean) => void
  onToggleAll: (value: boolean) => void
}) {
  return (
    <div className="border-t border-border/20">
      <button
        type="button"
        onClick={onToggleShow}
        className="w-full flex items-center justify-between px-4 py-2.5 text-start hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ToggleLeft className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fields</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] font-medium px-1.5 py-0 h-4 rounded",
              allAttrGranted
                ? "bg-primary/10 text-primary border-primary/20"
                : someAttrGranted
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-muted/50 text-muted-foreground border-border/30",
            )}
          >
            {attrGrantedCount}/{attributes.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onToggleAll(!allAttrGranted)
            }}
            className={cn(
              "text-[9px] font-medium px-2 py-0.5 rounded transition-colors",
              allAttrGranted
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5",
            )}
          >
            {allAttrGranted ? "Deselect All" : "Select All"}
          </button>
          {showAttributes ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {showAttributes && (
        <div className="px-4 pb-4 pt-1 bg-muted/5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1.5">
            {attributes.map(attr => (
              <AttributeChip
                key={attr.name}
                attr={attr}
                isGranted={permissions[attr.name] || false}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
