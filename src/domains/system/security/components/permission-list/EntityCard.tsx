"use client"

import { memo } from "react"
import { cn } from "@/shared/utils"
import { PermissionNode } from "./types"
import { useEntityCardState } from "./useEntityCardState"
import { SimplePermissionRow } from "./SimplePermissionRow"
import { EntityCardHeader } from "./EntityCardHeader"
import { ActionsSection } from "./ActionsSection"
import { AttributesSection } from "./AttributesSection"

export const EntityCard = memo(function EntityCard({
  node,
  permissions,
  onToggle,
}: {
  node: PermissionNode
  permissions: Record<string, boolean>
  onToggle: (name: string, checked: boolean) => void
}) {
  const {
    showAttributes,
    rootGranted,
    hasActions,
    hasAttributes,
    attrGrantedCount,
    allAttrGranted,
    someAttrGranted,
    actionGrantedCount,
    allActionsGranted,
    totalChildren,
    grantedChildren,
    handleToggleAll,
    handleToggleAllAttributes,
    handleToggleAllActions,
    toggleShowAttrs,
  } = useEntityCardState(node, permissions, onToggle)

  if (!hasActions && !hasAttributes) {
    return <SimplePermissionRow root={node.root} isGranted={rootGranted} onToggle={onToggle} />
  }

  return (
    <div
      className={cn(
        "bg-card border border-border/40 rounded-xl overflow-hidden transition-all hover:border-border/80 hover:shadow-sm",
        rootGranted && "border-primary/15",
      )}
    >
      <EntityCardHeader
        node={node}
        rootGranted={rootGranted}
        hasActions={hasActions}
        hasAttributes={hasAttributes}
        actionGrantedCount={actionGrantedCount}
        attrGrantedCount={attrGrantedCount}
        totalChildren={totalChildren}
        grantedChildren={grantedChildren}
        onToggle={onToggle}
        onToggleAll={handleToggleAll}
      />
      {hasActions && (
        <ActionsSection
          actions={node.actions}
          subActionMap={node.subActionMap}
          permissions={permissions}
          allActionsGranted={allActionsGranted}
          onToggle={onToggle}
          onToggleAll={handleToggleAllActions}
        />
      )}
      {hasAttributes && (
        <AttributesSection
          attributes={node.attributes}
          permissions={permissions}
          attrGrantedCount={attrGrantedCount}
          allAttrGranted={allAttrGranted}
          someAttrGranted={someAttrGranted}
          showAttributes={showAttributes}
          onToggleShow={toggleShowAttrs}
          onToggle={onToggle}
          onToggleAll={handleToggleAllAttributes}
        />
      )}
    </div>
  )
})
