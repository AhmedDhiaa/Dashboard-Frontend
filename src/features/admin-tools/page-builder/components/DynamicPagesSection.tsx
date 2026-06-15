"use client"

/**
 * DynamicPagesSection — sidebar group rendered next to RuntimeSidebarSection.
 *
 * Reads `/api/admin/page-builder/pages` (the same admin CRUD list endpoint
 * from Phase 6), then on the client:
 *   - keeps only pages with `navigation.enabled === true`
 *   - keeps only pages the viewer has `page.permission` for (via the
 *     existing PermissionContext — no new permission logic here)
 *   - groups by `navigation.group`
 *   - orders within each group by `navigation.order`
 *
 * The endpoint is admin-gated, so non-admin users get a 403 and the
 * section silently renders nothing.
 *
 * TODO(category-c): wire this section to a less-privileged read endpoint
 * once one exists. Today `/api/admin/page-builder/pages` requires
 * `Api.Admin.PageBuilder` (see route.ts:31) and also hosts the admin
 * write verbs (POST), so dropping the gate isn't safe. Trigger: backend
 * exposes a read-only `{ pages: PageSummaryWire[] }` endpoint gated by
 * the caller's per-page permissions, OR the existing handler is split
 * so GET is publicly readable while POST/PUT/DELETE stay admin-gated.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Sparkles } from "lucide-react"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { API_ROUTES } from "@/shared/api/routes"
import { errorReporter } from "@/infra/observability/error-reporter"

interface PageSummaryWire {
  id: string
  title: { en: string; ar: string }
  permission: string
  blockCount: number
  /** Phase 6 list endpoint doesn't include navigation today — handled below. */
  navigation?: {
    enabled: boolean
    group: string
    icon: string
    order: number
    href?: string
  }
}

interface VisiblePage {
  id: string
  title: string
  group: string
  iconName: string
  href: string
  order: number
}

const PAGES_GROUP_LABEL: Record<string, string> = {}

// Session-level cache. The page-builder list endpoint is admin-gated and may
// 403/404 when the feature isn't available; fetch it at most once per session
// so the sidebar (mounted on every route) doesn't re-fire a failing request on
// each remount. Permissions are stable within a session, so caching the
// filtered result is safe.
let cachedPages: VisiblePage[] | null = null

export function DynamicPagesSection({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const t = useT()
  const { isGranted, isAdmin } = usePermissionContext()
  const [pages, setPages] = useState<VisiblePage[] | null>(cachedPages)

  useEffect(() => {
    if (cachedPages) {
      setPages(cachedPages)
      return
    }
    const ac = new AbortController()
    void (async () => {
      try {
        const response = await fetch(API_ROUTES.pageBuilder.list, {
          credentials: "include",
          signal: ac.signal,
        })
        if (!response.ok) {
          // Admin-gated: non-admins / disabled feature get 403/404 — render
          // nothing, and remember it so we don't refetch on every remount.
          cachedPages = []
          setPages([])
          return
        }
        const data = (await response.json()) as { pages: PageSummaryWire[] }
        const visible = filterVisiblePages(data.pages, isGranted, isAdmin)
        cachedPages = visible
        setPages(visible)
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return
        errorReporter.captureException(err, { tags: { source: "page-builder.sidebar-section" } })
        cachedPages = []
        setPages([])
      }
    })()
    return () => ac.abort()
  }, [isGranted, isAdmin])

  if (!pages || pages.length === 0) return null

  const groups = groupPages(pages)

  return (
    <div className="px-2 py-3 space-y-3 border-t border-border/40" data-testid="dynamic-pages-section">
      {!collapsed && (
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Page Builder</p>
      )}
      {groups.map(([groupName, groupPages]) => (
        <div key={groupName} className="space-y-0.5">
          {!collapsed && groupName && (
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {PAGES_GROUP_LABEL[groupName] ? t(PAGES_GROUP_LABEL[groupName]) : groupName}
            </p>
          )}
          {groupPages.map(page => (
            <Link
              key={page.id}
              href={page.href}
              title={collapsed ? page.title : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === page.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                collapsed && "justify-center px-2",
              )}
              data-testid={`dynamic-page-link-${page.id}`}
            >
              <span className="shrink-0">
                <FileText className="h-4 w-4" />
              </span>
              {!collapsed && <span className="truncate">{page.title}</span>}
            </Link>
          ))}
        </div>
      ))}
      {!collapsed && (
        <p className="px-3 mt-2 text-[10px] text-muted-foreground/40 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          built with Page Builder
        </p>
      )}
    </div>
  )
}

function filterVisiblePages(
  pages: PageSummaryWire[],
  isGranted: (key: string) => boolean,
  isAdmin: boolean,
): VisiblePage[] {
  return pages
    .filter(p => p.navigation?.enabled === true)
    .filter(p => isAdmin || isGranted(p.permission))
    .map(p => ({
      id: p.id,
      title: p.title.en,
      group: p.navigation?.group ?? "",
      iconName: p.navigation?.icon ?? "FileText",
      href: p.navigation?.href ?? `/pages/${p.id}`,
      order: p.navigation?.order ?? 100,
    }))
}

function groupPages(pages: VisiblePage[]): Array<[string, VisiblePage[]]> {
  const map = new Map<string, VisiblePage[]>()
  for (const p of pages) {
    const list = map.get(p.group) ?? []
    list.push(p)
    map.set(p.group, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order)
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}
