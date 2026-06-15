"use client"

import * as React from "react"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { cn } from "@/shared/utils"

export interface BreadcrumbItem {
  title: string
  href?: string
  active?: boolean
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(({ className, items, ...props }, ref) => {
  const t = useTranslations()

  return (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      className={cn("flex items-center text-sm font-medium", className)}
      {...props}
    >
      <ol className="flex items-center gap-1.5 list-none m-0 p-0">
        <li className="flex items-center">
          <Link href="/" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
            <Home className="h-4 w-4" />
            <span className="sr-only">{t("nav.home")}</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            {item.href && !item.active ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-primary transition-colors truncate max-w-[150px]"
              >
                {item.title}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate max-w-[150px]",
                  item.active ? "text-foreground font-bold" : "text-muted-foreground",
                )}
                aria-current={item.active ? "page" : undefined}
              >
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
})
Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }
