"use client"

import { useMemo } from "react"
import { useT } from "@/shared/config"
import { PermissionListProps } from "./permission-list/types"
import { buildPermissionNodes } from "./permission-list/utils"
import { GroupHeader } from "./permission-list/GroupHeader"
import { EntityCard } from "./permission-list/EntityCard"

export function PermissionList({ group, permissions, onSetAll, onToggle }: PermissionListProps) {
  const t = useT()

  const nodes = useMemo(() => buildPermissionNodes(group.permissions), [group.permissions])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <GroupHeader group={group} permissions={permissions} onSetAll={onSetAll} t={t} />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-2">
          {nodes.map(node => (
            <EntityCard key={node.root.name} node={node} permissions={permissions} onToggle={onToggle} />
          ))}
        </div>
      </div>
    </div>
  )
}
