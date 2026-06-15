/**
 * Sidebar Navigation - Organized by Domain
 *
 * All entities properly categorized and sorted
 */

"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useT } from "@/shared/config"
import { cn, isPathActive } from "@/shared/utils"
import { useLayout } from "./LayoutContext"
import { usePermissions } from "@/core/auth/hooks/usePermissions"
import { NavGroupComponent } from "./sidebar/NavGroupComponent"
import { SidebarHeader } from "./sidebar/SidebarHeader"
import { SidebarCollapsedToggle, SidebarSearch, SidebarFooter } from "./sidebar/SidebarChrome"
import { useFilteredGroups } from "./sidebar/useFilteredGroups"
import dynamic from "next/dynamic"

// Lazy — pulls in the runtime store + recharts indirectly via providers,
// don't pay that cost on routes that don't render the sidebar.
const RuntimeSidebarSection = dynamic(() => import("@/features/runtime-builder").then(m => m.RuntimeSidebarSection), {
  ssr: false,
})

// Page-builder dynamic pages section. Lazy + ssr:false so the admin-only
// CRUD-list fetch runs after hydration; non-admin users get a 403 and
// the section silently renders nothing (no loading flash on the public
// dashboard).
const DynamicPagesSection = dynamic(
  () => import("@/features/admin-tools/page-builder/components/DynamicPagesSection").then(m => m.DynamicPagesSection),
  { ssr: false },
)

export function Sidebar() {
  const t = useT()
  const pathname = usePathname()
  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen, locale } = useLayout()
  const { isGranted, isAdmin } = usePermissions()
  const isRTL = locale === "ar"

  const [search, setSearch] = useState("")

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname, setIsMobileMenuOpen])

  // Filter groups by search AND permissions
  const filteredGroups = useFilteredGroups({ search, t, isGranted, isAdmin })

  // Find active group and initialize expanded state with it
  const activeGroupKey = useMemo(
    () => filteredGroups.find(g => g.items.some(i => isPathActive(pathname, i.href)))?.titleKey ?? null,
    [pathname, filteredGroups],
  )

  const [expanded, setExpanded] = useState<string | null>(activeGroupKey)
  const [prevActiveGroup, setPrevActiveGroup] = useState(activeGroupKey)

  // Update expanded when active group changes (derived state pattern)
  if (activeGroupKey !== prevActiveGroup) {
    setPrevActiveGroup(activeGroupKey)
    if (activeGroupKey) {
      setExpanded(activeGroupKey)
    }
  }

  // Handlers
  const toggleCollapse = useCallback(
    () => setIsSidebarCollapsed(!isSidebarCollapsed),
    [setIsSidebarCollapsed, isSidebarCollapsed],
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), [])

  const CollapseIcon = isRTL
    ? isSidebarCollapsed
      ? ChevronLeft
      : ChevronRight
    : isSidebarCollapsed
      ? ChevronRight
      : ChevronLeft

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "z-50 flex flex-col shrink-0 transition-transform duration-300 ease-out",
          // Sidebar surface uses the sidebar token (not card) — the
          // sidebar-* token family is a separate, slightly-cooler tint
          // that the eye reads as "system chrome" vs "content surface".
          "bg-sidebar border-e border-sidebar-border",
          // Mobile only: a soft shadow lifts the panel above the dim overlay.
          "shadow-lg lg:shadow-none",
          // Mobile: a fixed off-canvas overlay. Desktop: an in-flow (static)
          // flex item, so the main column sits flush beside it — no gap, no
          // overlap, at any width.
          "fixed top-0 bottom-0 start-0 lg:static",
          // Width is content-sized on desktop: it grows/shrinks with the nav
          // labels (so it adapts per language) within sane bounds. Collapsed is
          // a fixed icon rail; mobile uses a comfortable fixed panel width.
          isSidebarCollapsed ? "w-[70px]" : "w-72 lg:w-fit lg:min-w-[14rem] lg:max-w-[20rem]",
          // Mobile visibility — translate off-screen until the menu opens.
          // The logical -translate-x-full hides on the start edge; RTL
          // mirrors via translate-x-full on the same axis.
          isRTL
            ? isMobileMenuOpen
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0"
            : isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
        )}
      >
        <SidebarHeader
          isSidebarCollapsed={isSidebarCollapsed}
          toggleCollapse={toggleCollapse}
          CollapseIcon={CollapseIcon}
        />

        {isSidebarCollapsed && <SidebarCollapsedToggle toggleCollapse={toggleCollapse} CollapseIcon={CollapseIcon} />}

        {!isSidebarCollapsed && <SidebarSearch t={t} search={search} handleSearchChange={handleSearchChange} />}

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll space-y-0.5",
            // Tighter rail padding when collapsed so the icon chips center
            // on the narrow rail; comfortable padding when expanded.
            isSidebarCollapsed ? "px-2 py-3" : "px-3 py-3",
          )}
          aria-label={t("nav.a11y.main_navigation")}
        >
          {filteredGroups.map(group => (
            <NavGroupComponent
              key={group.titleKey}
              group={group}
              isOpen={expanded === group.titleKey}
              isActive={activeGroupKey === group.titleKey}
              isCollapsed={isSidebarCollapsed}
              pathname={pathname}
              isRTL={isRTL}
              t={t}
              onToggle={() => setExpanded(prev => (prev === group.titleKey ? null : group.titleKey))}
            />
          ))}

          <RuntimeSidebarSection collapsed={isSidebarCollapsed} />
          <DynamicPagesSection collapsed={isSidebarCollapsed} />
        </nav>

        <SidebarFooter isCollapsed={isSidebarCollapsed} />
      </aside>
    </>
  )
}
