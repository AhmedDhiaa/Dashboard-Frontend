"use client"

import { memo, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { cn, isPathActive } from "@/shared/utils"
import type { NavItem } from "@/shared/config/navigation"

interface NavItemLinkProps {
  item: NavItem
  isActive: boolean
  t: (key: string) => string
  pathname: string
  depth?: number
}

export const NavItemLink = memo<NavItemLinkProps>(({ item, isActive, t, pathname, depth = 0 }) => {
  const router = useRouter()
  const hasSubItems = !!(item.subItems && item.subItems.length > 0)
  const [isExpanded, setIsExpanded] = useState(() => {
    return !!(hasSubItems && item.subItems?.some(sub => isPathActive(pathname, sub.href)))
  })

  // [FIX] Removed `isExpanded` from the dependency array — it was causing
  // a read-during-write pattern that triggered infinite re-renders on rapid
  // navigation. We only need to respond to external pathname changes.
  // Only expand, never collapse programmatically — user controls collapse.
  useEffect(() => {
    if (!hasSubItems) return
    const shouldExpand = item.subItems?.some(sub => isPathActive(pathname, sub.href)) ?? false
    if (shouldExpand) {
      setIsExpanded(true)
    }
  }, [pathname, hasSubItems, item.subItems]) // isExpanded intentionally excluded

  return (
    <li className="list-none">
      {!hasSubItems ? (
        <Link href={item.href} prefetch onMouseEnter={() => router.prefetch(item.href)}>
          <NavItemContent
            item={item}
            isActive={isActive}
            t={t}
            depth={depth}
            isExpanded={isExpanded}
            onToggle={() => {}}
          />
        </Link>
      ) : (
        <NavItemContent
          item={item}
          isActive={isActive}
          t={t}
          depth={depth}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      )}
      {hasSubItems && isExpanded && (
        <ul className="mt-1 ms-3 ps-3 border-s border-sidebar-border space-y-0.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {item.subItems?.map(subItem => (
            <NavItemLink
              key={subItem.href}
              item={subItem}
              isActive={isPathActive(pathname, subItem.href)}
              t={t}
              pathname={pathname}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
})

NavItemLink.displayName = "NavItemLink"

/** Wrapper className. Active state = strong accent text + soft tinted
 *  background. No gradient, no left-border accent — visual noise on a
 *  dense nav. Hover lifts the muted bg only. The depth scale tightens
 *  the type by one step per level so a 3-deep tree reads as a hierarchy. */
function navItemClass(isActive: boolean, hasSubItems: boolean, depth: number): string {
  return cn(
    "group relative flex items-center gap-2 px-3 py-2 text-sm rounded-md",
    "transition-colors duration-150 cursor-pointer select-none",
    isActive && !hasSubItems
      ? "text-primary bg-primary/10 font-medium"
      : "text-sidebar-foreground/85 hover:text-foreground hover:bg-sidebar-accent/60",
    depth > 1 && "py-1.5 text-xs",
    depth === 1 && "py-1.5 text-[13px]",
  )
}

/** Icon className — neutral by default, primary when active, slightly
 *  smaller at deeper levels to reinforce hierarchy. */
function navIconClass(isActive: boolean, hasSubItems: boolean, depth: number): string {
  return cn(
    "shrink-0 transition-colors duration-150",
    depth === 0 ? "size-4" : "size-3.5",
    isActive && !hasSubItems ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
  )
}

const NavItemContent = memo(
  ({
    item,
    isActive,
    t,
    depth = 0,
    isExpanded,
    onToggle,
  }: {
    item: NavItem
    isActive: boolean
    t: (key: string) => string
    depth?: number
    isExpanded: boolean
    onToggle: () => void
  }) => {
    const hasSubItems = !!(item.subItems && item.subItems.length > 0)
    // [FIX] Render the icon if the NavItem definition has one.
    // Icons were defined on NavItem but never rendered — all items appeared text-only.
    const Icon = item.icon

    return (
      <div
        className={navItemClass(isActive, hasSubItems, depth)}
        onClick={onToggle}
        role={hasSubItems ? "button" : undefined}
        aria-expanded={hasSubItems ? isExpanded : undefined}
      >
        {/* Active indicator: a 2px rounded vertical bar pinned to the start
            edge. Communicates "selected" without animation, survives at any
            nav-row height, RTL-safe via `start-0`. */}
        {isActive && !hasSubItems && (
          <span className="absolute start-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" aria-hidden="true" />
        )}
        {Icon && <Icon className={navIconClass(isActive, hasSubItems, depth)} aria-hidden="true" />}
        <span className="truncate flex-1">{t(item.titleKey)}</span>
        {hasSubItems && (
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              isExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </div>
    )
  },
)
NavItemContent.displayName = "NavItemContent"
