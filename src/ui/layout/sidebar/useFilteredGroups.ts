"use client"

import { useMemo } from "react"
import { NAV_GROUPS } from "@/shared/config/navigation"

interface UseFilteredGroupsArgs {
  search: string
  t: (key: string) => string
  isGranted: (permission: string) => boolean
  isAdmin: boolean
}

export function useFilteredGroups({ search, t, isGranted, isAdmin }: UseFilteredGroupsArgs) {
  return useMemo(() => {
    return NAV_GROUPS.map(group => {
      // Filter items within group
      const allowedItems = group.items
        .map(item => {
          // Filter subItems by permission
          if (item.subItems && item.subItems.length > 0) {
            const allowedSubItems = item.subItems.filter(sub => {
              if (sub.requiredPermission && !isGranted(sub.requiredPermission)) return false
              return true
            })
            return { ...item, subItems: allowedSubItems }
          }
          return item
        })
        .filter(item => {
          // Search filter
          const matchesSearch = !search.trim() || t(item.titleKey).toLowerCase().includes(search.toLowerCase())
          if (!matchesSearch) return false

          // Permission filter
          if (item.requiredPermission && !isGranted(item.requiredPermission)) return false

          return true
        })

      return { ...group, items: allowedItems }
    }).filter(group => {
      // Hide empty groups
      if (group.items.length === 0) return false

      // Admin-only groups (the no-code Studio) are hidden from non-admins.
      if (group.adminOnly && !isAdmin) return false

      // Group permission check
      if (group.requiredPermission && !isGranted(group.requiredPermission)) return false

      return true
    })
  }, [search, t, isGranted, isAdmin])
}
