import { PermissionDto } from "@/shared/types/security.types"
import { PermissionNode } from "./types"

export function cleanDisplayName(displayName: string): string {
  let name = displayName
  if (name.startsWith("Permission:TEntity:Entity:")) {
    name = name.replace("Permission:TEntity:Entity:", "")
  } else if (name.startsWith("Permission:Report:")) {
    name = name.replace("Permission:Report:", "")
  } else if (name.startsWith("Permission:")) {
    name = name.replace("Permission:", "")
  }
  return name.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function buildPermissionNodes(allPermissions: PermissionDto[]): PermissionNode[] {
  const byName = new Map<string, PermissionDto>()
  allPermissions.forEach(p => byName.set(p.name, p))

  const roots = allPermissions.filter(p => !p.parentName || !byName.has(p.parentName))

  const childrenOf = new Map<string, PermissionDto[]>()
  allPermissions.forEach(p => {
    if (p.parentName && byName.has(p.parentName)) {
      const existing = childrenOf.get(p.parentName) ?? []
      existing.push(p)
      childrenOf.set(p.parentName, existing)
    }
  })

  return roots.map(root => {
    const directChildren = childrenOf.get(root.name) ?? []
    const actions: PermissionDto[] = []
    const attributes: PermissionDto[] = []
    const subActionMap: Record<string, PermissionDto[]> = {}

    directChildren.forEach(child => {
      if (child.name.includes(".Entity.")) {
        attributes.push(child)
      } else {
        actions.push(child)
        const grandChildren = childrenOf.get(child.name) ?? []
        if (grandChildren.length > 0) {
          subActionMap[child.name] = grandChildren
        }
      }
    })

    return { root, actions, attributes, subActionMap }
  })
}
