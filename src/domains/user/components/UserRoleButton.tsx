/**
 * User Role Button Component
 * Triggers the UserRoleModal for a specific user
 */

"use client"

import { useState } from "react"
import { UserCheck } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { UserRoleModal } from "./UserRoleModal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import { useT } from "@/shared/config"

export interface UserRoleButtonProps {
  userId: string
  userName: string
  variant?: "outline" | "ghost" | "default" | "secondary" | "warning"
  size?: "default" | "sm" | "lg" | "icon"
  showText?: boolean
}

export function UserRoleButton({
  userId,
  userName,
  variant = "outline",
  size = "sm",
  showText = false,
}: UserRoleButtonProps) {
  const [open, setOpen] = useState(false)
  const t = useT()

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={e => {
                e.stopPropagation()
                setOpen(true)
              }}
              className={showText ? "gap-2" : ""}
            >
              <UserCheck className="h-4 w-4 text-primary" />
              {showText && <span>{t("pages.user.manage_roles")}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{t("pages.user.manage_roles")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UserRoleModal userId={userId} userName={userName} open={open} onOpenChange={setOpen} />
    </>
  )
}
