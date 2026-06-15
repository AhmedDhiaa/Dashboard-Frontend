"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Maximize2, Minimize2 } from "lucide-react"
import { Card } from "@/ui/design-system/primitives/card"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"

interface DashboardCardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  icon?: React.ElementType
  isLoading?: boolean
  delay?: number
  headerActions?: React.ReactNode
  noPadding?: boolean
}

/**
 * Flat, minimal dashboard card — Linear/Vercel style. Hairline border, solid
 * surface, compact header. Each card carries minimize (collapse the body) and
 * maximize (expand to a focused full-screen overlay) controls.
 */
const CardIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
    <Icon className="h-[18px] w-[18px]" />
  </div>
)

const CardTitle = ({ title, subtitle }: { title?: string; subtitle?: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    {title && <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h3>}
    {subtitle && (
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{subtitle}</p>
    )}
  </div>
)

interface ControlsProps {
  collapsed: boolean
  maximized: boolean
  labels: { minimize: string; maximize: string; restore: string }
  onToggleCollapse: () => void
  onToggleMaximize: () => void
}

const ctrlBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

function CardControls({ collapsed, maximized, labels, onToggleCollapse, onToggleMaximize }: ControlsProps) {
  const collapseLabel = collapsed ? labels.restore : labels.minimize
  const maxLabel = maximized ? labels.restore : labels.maximize
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" onClick={onToggleCollapse} title={collapseLabel} aria-label={collapseLabel} className={ctrlBtn}>
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", collapsed && "-rotate-90")} />
      </button>
      <button type="button" onClick={onToggleMaximize} title={maxLabel} aria-label={maxLabel} className={ctrlBtn}>
        {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

function CardBody({ children, noPadding, hasHeader, maximized }: { children: React.ReactNode; noPadding: boolean; hasHeader: boolean; maximized: boolean }) {
  return (
    <div className={cn(noPadding ? "p-0" : "p-5", !noPadding && hasHeader && "pt-4", maximized && "min-h-0 flex-1 overflow-auto")}>
      {children}
    </div>
  )
}

export function DashboardCard({
  children,
  className,
  title,
  subtitle,
  icon: Icon,
  isLoading,
  delay = 0,
  headerActions,
  noPadding = false,
}: DashboardCardProps) {
  const t = useT("common")
  const [collapsed, setCollapsed] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const hasHeader = !!(title || Icon || headerActions)
  const labels = {
    minimize: t("dashboard_card.minimize"),
    maximize: t("dashboard_card.maximize"),
    restore: t("dashboard_card.restore"),
  }

  const inner = (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 @container/card hover:border-foreground/15",
        maximized ? "flex h-full flex-col" : "h-full",
        className,
      )}
    >
      {hasHeader && (
        <div className={cn("flex items-start justify-between gap-3", noPadding ? "px-5 pt-4" : "px-5 pt-5 pb-1")}>
          <div className="flex min-w-0 items-center gap-3">
            {Icon && <CardIcon icon={Icon} />}
            <CardTitle title={title} subtitle={subtitle} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <CardControls
              collapsed={collapsed}
              maximized={maximized}
              labels={labels}
              onToggleCollapse={() => setCollapsed(c => !c)}
              onToggleMaximize={() => {
                setMaximized(m => !m)
                setCollapsed(false)
              }}
            />
          </div>
        </div>
      )}
      {!collapsed && <CardBody noPadding={noPadding} hasHeader={hasHeader} maximized={maximized}>{children}</CardBody>}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-card/70 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-primary" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("dashboard_card.syncing")}
            </span>
          </div>
        </div>
      )}
    </Card>
  )

  if (maximized && typeof document !== "undefined") {
    // Portal to <body> so the overlay escapes the card's transformed ancestors
    // (framer-motion / the entrance animation set `transform`, which would
    // otherwise trap `position: fixed`). The dashed slot keeps the grid stable.
    return (
      <>
        <div
          className="h-full animate-dashboard-card rounded-xl border border-dashed border-border/60 bg-muted/10"
          style={{ animationDelay: `${delay}s` }}
        />
        {createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMaximized(false)} />
            <div className="relative z-10 h-full w-full max-w-6xl">{inner}</div>
          </div>,
          document.body,
        )}
      </>
    )
  }

  return (
    <div className="h-full animate-dashboard-card" style={{ animationDelay: `${delay}s` }}>
      {inner}
    </div>
  )
}
