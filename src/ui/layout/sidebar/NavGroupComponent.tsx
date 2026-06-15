"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { cn, isPathActive } from "@/shared/utils"
import type { NavGroup } from "@/shared/config/navigation"
import { NavItemLink } from "./NavItemLink"
import { FlyoutNavItem } from "./FlyoutNavItem"

interface NavGroupComponentProps {
  group: NavGroup
  isOpen: boolean
  isActive: boolean
  isCollapsed: boolean
  pathname: string
  isRTL: boolean
  t: (key: string) => string
  onToggle: () => void
}

export const NavGroupComponent = memo<NavGroupComponentProps>(
  // eslint-disable-next-line max-lines-per-function -- Complex arrow function with flyout positioning and event handlers
  ({ group, isOpen, isActive, isCollapsed, pathname, isRTL, t, onToggle }) => {
    const Icon = group.icon
    const groupRef = useRef<HTMLDivElement>(null)
    const [showFlyout, setShowFlyout] = useState(false)
    const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, bottom: "auto" as "auto" | number })
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = useCallback(() => {
      if (!isCollapsed) return

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }

      if (groupRef.current) {
        const rect = groupRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const estimatedHeight = group.items.length * 40 + 60 // Estimate height: items * 40px + header

        // Smart positioning: if it would overflow bottom, align bottom with the icon or lift it
        if (rect.top + estimatedHeight > viewportHeight - 20) {
          setFlyoutPosition({
            top: Math.max(20, viewportHeight - estimatedHeight - 20),
            bottom: "auto",
          })
        } else {
          setFlyoutPosition({ top: rect.top, bottom: "auto" })
        }
      }
      setShowFlyout(true)
    }, [isCollapsed, group.items.length])

    const handleMouseLeave = useCallback(() => {
      if (!isCollapsed) return

      hoverTimeoutRef.current = setTimeout(() => {
        setShowFlyout(false)
      }, 150)
    }, [isCollapsed])

    const handleFlyoutMouseEnter = useCallback(() => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }, [])

    const handleFlyoutMouseLeave = useCallback(() => {
      setShowFlyout(false)
    }, [])

    const handleItemClick = useCallback(() => {
      setShowFlyout(false)
    }, [])

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }
      }
    }, [])

    return (
      <div ref={groupRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {/* Group Header — single neutral row, no gradient. Active state is
            communicated by a soft tinted icon chip + accent text, kept
            consistent with the leaf indicator (bg-primary/10 text-primary).
            Hover lifts the muted bg only. */}
        <button
          type="button"
          onClick={!isCollapsed ? onToggle : undefined}
          aria-expanded={isOpen}
          className={cn(
            "group relative flex w-full items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium",
            "transition-colors duration-150",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            isCollapsed && "justify-center px-0",
          )}
        >
          {/* Collapsed icon-rail active marker — a 2px start-edge bar so the
              active group reads at a glance without expanding. RTL-safe. */}
          {isActive && isCollapsed && (
            <span className="absolute start-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" aria-hidden="true" />
          )}
          <span
            className={cn(
              "flex items-center justify-center size-8 rounded-md transition-colors duration-150",
              isActive
                ? "bg-primary/10 text-primary"
                : "bg-transparent text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>

          {!isCollapsed && (
            <>
              <span className="flex-1 text-start truncate">{t(group.titleKey)}</span>
              <ChevronDown
                className={cn("size-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
              />
            </>
          )}
        </button>

        {/* Expanded Items (non-collapsed) */}
        {!isCollapsed && (
          <div
            className={cn(
              "grid transition-all duration-200 ease-out",
              isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <ul className="overflow-hidden mt-1 ms-4 ps-3 border-s border-sidebar-border space-y-0.5">
              {group.items.map(item => (
                <NavItemLink
                  key={item.href}
                  item={item}
                  isActive={isPathActive(pathname, item.href)}
                  t={t}
                  pathname={pathname}
                />
              ))}
            </ul>
          </div>
        )}

        {isCollapsed && showFlyout && (
          <div
            className="fixed z-[100]"
            style={{
              top: flyoutPosition.top,
              bottom: flyoutPosition.bottom,
              ...(isRTL ? { right: 72 } : { left: 72 }),
            }}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
          >
            <div
              className={cn(
                // Floating flyout — flat popover. Solid bg-popover, single
                // neutral border, modest shadow to read as floating (no
                // glass/gradient/lift). Matches DropdownMenu surface.
                "min-w-dropdown-wide py-1.5 px-1.5 rounded-lg",
                "bg-popover text-popover-foreground border border-border shadow-md",
                "animate-in fade-in-0 slide-in-from-left-1 duration-150",
                isRTL && "slide-in-from-right-1",
              )}
            >
              {/* Flyout header — group title with its icon, separated by a
                  hairline from the items below. */}
              <div className="px-2.5 py-1.5 mb-1 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary shrink-0">
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-semibold text-foreground truncate">{t(group.titleKey)}</span>
                </div>
              </div>
              {/* Flyout items */}
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <FlyoutNavItem
                    key={item.href}
                    item={item}
                    isActive={isPathActive(pathname, item.href)}
                    t={t}
                    onItemClick={handleItemClick}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  },
)
NavGroupComponent.displayName = "NavGroupComponent"
