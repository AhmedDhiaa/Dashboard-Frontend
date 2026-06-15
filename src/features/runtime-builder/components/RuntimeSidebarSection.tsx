"use client"

/**
 * RuntimeSidebarSection — a self-contained sidebar group that lives at
 * the bottom of the static Sidebar and renders one nav link per enabled
 * runtime page. Re-renders live when the runtime config changes.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Database, LayoutDashboard, Wrench } from "lucide-react"
import { useRuntimeConfig } from "../store"
import { cn } from "@/shared/utils"

export function RuntimeSidebarSection({ collapsed = false }: { collapsed?: boolean }) {
  const config = useRuntimeConfig()
  const pathname = usePathname()
  const pages = config.pages.filter(p => p.enabled).sort((a, b) => a.order - b.order)

  // Always show the Builder link; pages are conditional
  return (
    <div className="px-2 py-3 space-y-0.5 border-t border-border/40">
      {!collapsed && (
        <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Builder</p>
      )}

      <SidebarLink
        href="/builder"
        label="Runtime Builder"
        icon={<Wrench className="h-4 w-4" />}
        active={pathname.includes("/builder")}
        collapsed={collapsed}
      />

      {pages.length > 0 && !collapsed && (
        <p className="px-3 mt-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          My Pages
        </p>
      )}

      {pages.map(page => {
        const href =
          page.type === "entity"
            ? `/runtime/${page.entityId}`
            : page.type === "dashboard"
              ? `/runtime/dashboard/${page.dashboardId}`
              : "#"
        return (
          <SidebarLink
            key={page.id}
            href={href}
            label={page.title}
            icon={
              page.type === "dashboard" ? <LayoutDashboard className="h-4 w-4" /> : <Database className="h-4 w-4" />
            }
            active={pathname.includes(href)}
            collapsed={collapsed}
          />
        )
      })}
    </div>
  )
}

interface SidebarLinkProps {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  collapsed: boolean
}

function SidebarLink({ href, label, icon, active, collapsed }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        collapsed && "justify-center px-2",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}
