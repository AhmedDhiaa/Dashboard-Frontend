"use client"

import type React from "react"
import { memo } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"
import { BrandMark, BrandLogo } from "@/ui/brand/Logo"

export const SidebarHeader = memo(function SidebarHeader({
  isSidebarCollapsed,
  toggleCollapse,
  CollapseIcon,
}: {
  isSidebarCollapsed: boolean
  toggleCollapse: () => void
  CollapseIcon: React.ElementType
}) {
  const t = useT("nav")
  return (
    <header
      className={cn(
        // Clean header bar — single bottom border, inherits the sidebar surface.
        "relative flex items-center h-16 px-4 shrink-0 border-b border-sidebar-border",
        isSidebarCollapsed ? "justify-center" : "justify-between",
      )}
    >
      {/* White-label brand — asset-free SVG mark (collapsed) / mark + wordmark. */}
      {isSidebarCollapsed ? <BrandMark className="size-9" /> : <BrandLogo />}

      {!isSidebarCollapsed && (
        <Button
          size="iconSm"
          variant="ghost"
          onClick={toggleCollapse}
          aria-label={t("a11y.collapse_sidebar")}
          className="text-muted-foreground"
        >
          <CollapseIcon className="size-4" />
        </Button>
      )}
    </header>
  )
})
SidebarHeader.displayName = "SidebarHeader"
