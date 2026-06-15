"use client"

import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { Label } from "@/ui/design-system/primitives/label"
import { useT } from "@/shared/config"
import type { IdentityUserRole } from "@/shared/types/security.types"

interface UserRoleItemProps {
  role: IdentityUserRole
  isSelected: boolean
  onToggle: (roleName: string) => void
}

export function UserRoleItem({ role, isSelected, onToggle }: UserRoleItemProps) {
  const t = useT()

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
      <Checkbox
        id={`role-${role.id}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(role.name)}
        disabled={role.isStatic}
      />
      <div
        className="grid gap-1.5 leading-none cursor-pointer flex-1"
        onClick={() => !role.isStatic && onToggle(role.name)}
      >
        <Label
          htmlFor={`role-${role.id}`}
          className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {role.name}
        </Label>
        {role.isStatic && (
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            {t("pages.roles.is_static")}
          </span>
        )}
        {role.isDefault && (
          <span className="text-[10px] text-primary uppercase font-bold tracking-wider">
            {t("pages.roles.is_default")}
          </span>
        )}
      </div>
    </div>
  )
}
