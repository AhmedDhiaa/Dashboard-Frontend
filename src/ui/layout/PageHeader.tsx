import { cn } from "@/shared/utils"
import { Breadcrumbs } from "@/ui/design-system/primitives/breadcrumbs"
import type { BreadcrumbItem } from "@/ui/design-system/primitives/breadcrumbs"

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumbs, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-1" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight truncate">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </div>
  )
}
