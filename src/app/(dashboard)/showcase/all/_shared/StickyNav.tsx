"use client"

import { useEffect, useState } from "react"
import { Menu, ChevronRight } from "lucide-react"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"
import { Button } from "@/ui/design-system/primitives/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/design-system/primitives/sheet"

export interface StickyNavItem {
  id: string
  label: string
}

interface StickyNavProps {
  items: readonly StickyNavItem[]
}

/**
 * Sticky vertical rail listing every mega-page section. On desktop renders
 * as a fixed sidebar; on mobile (< lg) collapses behind a floating Sheet
 * trigger. The active item is tracked via IntersectionObserver — whichever
 * section crosses the 30% threshold is highlighted in the nav.
 */
export function StickyNav({ items }: StickyNavProps) {
  const activeId = useActiveSection(items)
  return (
    <>
      <DesktopNav items={items} activeId={activeId} />
      <MobileNav items={items} activeId={activeId} />
    </>
  )
}

function DesktopNav({ items, activeId }: { items: readonly StickyNavItem[]; activeId: string | null }) {
  const t = useT("showcase")
  return (
    <nav
      aria-label={t("nav.heading")}
      className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-auto"
    >
      <ul className="space-y-1 text-sm">
        {items.map(item => (
          <li key={item.id}>
            <NavLink item={item} active={activeId === item.id} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MobileNav({ items, activeId }: { items: readonly StickyNavItem[]; activeId: string | null }) {
  const [open, setOpen] = useState(false)
  const t = useT("showcase")
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="primary"
          size="iconLg"
          className="lg:hidden fixed bottom-6 end-6 z-40 shadow-lg"
          aria-label={t("nav.open")}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{t("nav.sections")}</SheetTitle>
        </SheetHeader>
        <ul className="mt-6 space-y-1 text-sm">
          {items.map(item => (
            <li key={item.id}>
              <NavLink item={item} active={activeId === item.id} onClick={() => setOpen(false)} />
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}

function NavLink({ item, active, onClick }: { item: StickyNavItem; active: boolean; onClick?: () => void }) {
  return (
    <a
      href={`#${item.id}`}
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-current={active ? "true" : undefined}
    >
      <span className="truncate">{item.label}</span>
      <ChevronRight
        className={cn(
          "h-3 w-3 shrink-0 transition-transform rtl:rotate-180",
          active ? "text-primary" : "text-muted-foreground/40 group-hover:text-foreground/60",
        )}
        aria-hidden="true"
      />
    </a>
  )
}

function useActiveSection(items: readonly StickyNavItem[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    if (items.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio)
          } else {
            visible.delete(entry.target.id)
          }
        }
        // Pick the section with the highest visible ratio; fall back to the
        // first item if everything has scrolled past.
        let best: { id: string; ratio: number } | null = null
        for (const [id, ratio] of visible) {
          if (!best || ratio > best.ratio) best = { id, ratio }
        }
        if (best) setActiveId(best.id)
      },
      { threshold: [0.3, 0.5, 0.8] },
    )

    const targets = items.map(item => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null)
    targets.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  return activeId
}
