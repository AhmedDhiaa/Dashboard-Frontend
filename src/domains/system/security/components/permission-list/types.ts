import { PermissionDto, PermissionGroupDto } from "@/shared/types/security.types"

export interface PermissionListProps {
  group: PermissionGroupDto
  permissions: Record<string, boolean>
  onSetAll: (group: PermissionGroupDto, value: boolean) => void
  onToggle: (name: string, checked: boolean) => void
}

export interface PermissionNode {
  root: PermissionDto
  actions: PermissionDto[]
  attributes: PermissionDto[]
  subActionMap: Record<string, PermissionDto[]>
}
