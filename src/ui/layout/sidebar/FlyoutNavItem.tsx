"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { cn } from "@/shared/utils"
import type { NavItem } from "@/shared/config/navigation"

interface FlyoutNavItemProps {
  item: NavItem
  isActive: boolean
  t: (key: string) => string
  onItemClick?: (() => void) | undefined
  depth?: number
}

export const FlyoutNavItem = memo<FlyoutNavItemProps>(({ item, isActive, t, onItemClick, depth = 0 }) => {
  const hasSubItems = item.subItems && item.subItems.length > 0
  const pathname = usePathname()
  const router = useRouter()

  return (
    <li className="list-none">
      <Link
        href={item.href}
        prefetch
        onMouseEnter={() => router.prefetch(item.href)}
        {...(onItemClick && { onClick: onItemClick })}
        className={cn(
          "group relative flex items-center gap-2 px-3 py-2 text-sm rounded-md whitespace-nowrap",
          "transition-colors duration-150",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
          depth > 0 && "py-1.5 text-xs",
        )}
      >
        {/* Active indicator — same 2px start-edge bar as the expanded nav,
            kept consistent across collapsed (flyout) and expanded states. */}
        {isActive && (
          <span className="absolute start-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" aria-hidden="true" />
        )}
        <span className="truncate">{t(item.titleKey)}</span>
        {hasSubItems && <ChevronRight className="size-3 ms-auto shrink-0 text-muted-foreground/60 rtl:rotate-180" />}
      </Link>
      {hasSubItems && (
        <ul className="ms-4 my-1 ps-2 border-s border-border space-y-0.5">
          {item.subItems?.map(sub => (
            <FlyoutNavItem
              key={sub.href}
              item={sub}
              isActive={pathname === sub.href}
              t={t}
              onItemClick={onItemClick}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
})
FlyoutNavItem.displayName = "FlyoutNavItem"
