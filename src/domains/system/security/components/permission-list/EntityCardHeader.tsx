"use client"

import { memo } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { Badge } from "@/ui/design-system/primitives/badge"
import { cn } from "@/shared/utils"
import { PermissionNode } from "./types"
import { cleanDisplayName } from "./utils"

const EntityInfo = memo(
  ({
    node,
    hasActions,
    hasAttributes,
    actionGrantedCount,
    attrGrantedCount,
    rootGranted,
  }: {
    node: PermissionNode
    hasActions: boolean
    hasAttributes: boolean
    actionGrantedCount: number
    attrGrantedCount: number
    rootGranted: boolean
  }) => (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shrink-0",
          rootGranted
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-muted/50 text-muted-foreground border-border/50",
        )}
      >
        <ShieldCheck className="h-4 w-4" />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{cleanDisplayName(node.root.displayName)}</span>
          {hasActions && (
            <Badge
              variant="outline"
              className="text-[9px] font-medium bg-primary/8 text-primary border-primary/20 px-1.5 py-0 h-4 rounded"
            >
              {actionGrantedCount}/{node.actions.length} actions
            </Badge>
          )}
          {hasAttributes && (
            <Badge
              variant="outline"
              className="text-[9px] font-medium bg-accent text-accent-foreground border-accent px-1.5 py-0 h-4 rounded"
            >
              {attrGrantedCount}/{node.attributes.length} fields
            </Badge>
          )}
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/40 truncate">{node.root.name}</span>
      </div>
    </div>
  ),
)
EntityInfo.displayName = "EntityInfo"

const HeaderActions = memo(
  ({
    totalChildren,
    grantedChildren,
    rootGranted,
    onToggle,
    onToggleAll,
    rootName,
  }: {
    totalChildren: number
    grantedChildren: number
    rootGranted: boolean
    onToggle: (name: string, checked: boolean) => void
    onToggleAll: (value: boolean) => void
    rootName: string
  }) => (
    <div className="flex items-center gap-2 shrink-0">
      {totalChildren > 0 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(true)}
            disabled={rootGranted && grantedChildren === totalChildren}
            className="h-6 px-2 text-[9px] text-muted-foreground hover:text-primary rounded"
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(false)}
            disabled={!rootGranted && grantedChildren === 0}
            className="h-6 px-2 text-[9px] text-muted-foreground hover:text-destructive rounded"
          >
            None
          </Button>
        </div>
      )}
      <Checkbox
        checked={rootGranted}
        onCheckedChange={checked => onToggle(rootName, !!checked)}
        className="h-5 w-5 rounded-md"
      />
    </div>
  ),
)
HeaderActions.displayName = "HeaderActions"

export const EntityCardHeader = memo(function EntityCardHeader({
  node,
  rootGranted,
  hasActions,
  hasAttributes,
  actionGrantedCount,
  attrGrantedCount,
  totalChildren,
  grantedChildren,
  onToggle,
  onToggleAll,
}: {
  node: PermissionNode
  rootGranted: boolean
  hasActions: boolean
  hasAttributes: boolean
  actionGrantedCount: number
  attrGrantedCount: number
  totalChildren: number
  grantedChildren: number
  onToggle: (name: string, checked: boolean) => void
  onToggleAll: (value: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3 transition-colors",
        rootGranted ? "bg-primary/2" : "",
      )}
    >
      <EntityInfo
        node={node}
        hasActions={hasActions}
        hasAttributes={hasAttributes}
        actionGrantedCount={actionGrantedCount}
        attrGrantedCount={attrGrantedCount}
        rootGranted={rootGranted}
      />
      <HeaderActions
        totalChildren={totalChildren}
        grantedChildren={grantedChildren}
        rootGranted={rootGranted}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
        rootName={node.root.name}
      />
    </div>
  )
})
