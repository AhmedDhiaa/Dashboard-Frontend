"use client"

import type React from "react"
import { memo } from "react"
import { Search, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

export const SidebarCollapsedToggle = memo(function SidebarCollapsedToggle({
  toggleCollapse,
  CollapseIcon,
}: {
  toggleCollapse: () => void
  CollapseIcon: React.ElementType
}) {
  const t = useT("nav")
  return (
    <div className="flex justify-center py-3 border-b border-sidebar-border shrink-0">
      <Button
        size="iconSm"
        variant="ghost"
        onClick={toggleCollapse}
        aria-label={t("a11y.expand_sidebar")}
        className="text-muted-foreground"
      >
        <CollapseIcon className="size-4" />
      </Button>
    </div>
  )
})
SidebarCollapsedToggle.displayName = "SidebarCollapsedToggle"

export const SidebarSearch = memo(
  ({
    t,
    search,
    handleSearchChange,
  }: {
    t: (key: string) => string
    search: string
    handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }) => (
    <div className="px-3 py-3 shrink-0">
      <div className="relative">
        <Search
          className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder={t("common.search")}
          value={search}
          onChange={handleSearchChange}
          className={cn(
            // Matches the global Input geometry — h-9 instead of h-11 so
            // the sidebar's vertical density compresses to fit more nav
            // groups without a scroll. Solid bg-input from the token
            // family — no backdrop-blur on a non-floating surface.
            "w-full h-9 ps-9 pe-3 rounded-lg text-sm",
            "bg-input border border-sidebar-border text-foreground",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring",
            "transition-colors duration-150",
          )}
        />
      </div>
    </div>
  ),
)
SidebarSearch.displayName = "SidebarSearch"

export const SidebarFooter = memo(function SidebarFooter({ isCollapsed }: { isCollapsed: boolean }) {
  const t = useT("nav")
  const router = useRouter()

  // Sign out → login page. Navigate first so the login screen shows at once;
  // signOut clears the session in the background. Re-logging in returns to the
  // dashboard (the login page's default redirect target).
  const handleSignOut = () => {
    router.push("/auth/login")
    signOut({ redirect: false }).catch(() => {
      /* ignore — the navigation already moved the user to the login screen */
    })
  }

  return (
    <div className="shrink-0 border-t border-sidebar-border p-2">
      <Button
        variant="ghost"
        onClick={handleSignOut}
        title={t("logout")}
        aria-label={t("logout")}
        className={cn(
          "w-full text-muted-foreground hover:text-foreground",
          isCollapsed ? "justify-center px-0" : "justify-start gap-2.5",
        )}
      >
        <LogOut className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        {!isCollapsed && <span className="text-sm">{t("logout")}</span>}
      </Button>
    </div>
  )
})
SidebarFooter.displayName = "SidebarFooter"
