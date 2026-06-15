"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useLayout } from "@/ui/layout/LayoutContext"
import { pushRecentRecord } from "@/shared/utils/recent-records"

/** Best-effort human label for a record, for the per-record breadcrumb. */
export function pickRecordName(entity: Record<string, unknown>): string | null {
  for (const key of ["name", "documentRef", "reference", "fullName", "title", "code", "userName"]) {
    const v = entity[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/**
 * Sets the header breadcrumb to the loaded record (e.g. "Orders › ORD-123")
 * instead of the generic entity label, then restores on unmount. Renders null.
 *
 * Shared by the config-driven detail page and the edit page. The detail page
 * also records the visit for the command palette's "Recent" group (`record`
 * defaults to true); edit pages pass `record={false}` so a half-edited form
 * URL never becomes a "recent record" deep link.
 */
export function RecordBreadcrumb({
  name,
  listTitle,
  record = true,
}: {
  name: string | null
  listTitle: string
  record?: boolean
}) {
  const { setPageTitle, setPageDescription } = useLayout()
  const pathname = usePathname()
  useEffect(() => {
    if (!name) return
    setPageTitle(name)
    setPageDescription(listTitle)
    if (record && pathname) pushRecentRecord({ href: pathname, title: name, entity: listTitle }, Date.now())
    return () => {
      setPageTitle(null)
      setPageDescription(null)
    }
  }, [name, listTitle, record, pathname, setPageTitle, setPageDescription])
  return null
}
