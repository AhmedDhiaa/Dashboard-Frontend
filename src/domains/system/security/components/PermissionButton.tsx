/**
 * Permission Button Component
 * Triggers the PermissionModal for a specific provider.
 * Renders a tooltip-wrapped button that opens the full-screen permission sheet.
 */

"use client"

import { useState } from "react"
import { Shield } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { PermissionModal } from "./PermissionModal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

export interface PermissionButtonProps {
  providerName: string
  providerKey: string
  variant?: "outline" | "ghost" | "default" | "secondary" | "warning"
  size?: "default" | "sm" | "lg" | "icon"
  showText?: boolean
  onSuccess?: () => void
  className?: string
  disabled?: boolean
}

export function PermissionButton({
  providerName,
  providerKey,
  variant = "outline",
  size = "sm",
  showText = false,
  onSuccess,
  className,
  disabled = false,
}: PermissionButtonProps) {
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
              disabled={disabled}
              onClick={e => {
                e.stopPropagation()
                setOpen(true)
              }}
              className={cn(showText ? "gap-1.5" : "", "transition-colors", className)}
            >
              <Shield className="h-4 w-4 text-primary" />
              {showText && <span className="text-xs font-medium">{t("pages.permissions") || "Permissions"}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t("pages.permissions") || "Permissions"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PermissionModal
        providerName={providerName}
        providerKey={providerKey}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  )
}
