"use client"

/**
 * NotificationBell — the global header bell. Shows an unread-count badge and,
 * on open, a dropdown with the most recent notifications plus a "show all"
 * action that routes to the full /notifications list.
 *
 * Lives in `features/` (not `ui/`) so it may import the notification domain
 * service directly; the header pulls it in via `next/dynamic` (a dynamic
 * import is exempt from the ui→features layer rule), mirroring how the header
 * already lazy-loads its other add-ons.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Loader2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { useT, useLocale } from "@/shared/config"
import { cn } from "@/shared/utils"
import { notificationService, type Notification } from "@/domains/notifications/notification.service"

/** Most recent notifications shown inline before the "show all" link. */
const MAX_VISIBLE = 5

export function NotificationBell() {
  const t = useT()
  const { isRTL, locale } = useLocale()
  const router = useRouter()

  const [items, setItems] = useState<Notification[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationService.getCurrentList()
      setItems((res.items ?? []).slice(0, MAX_VISIBLE))
      setTotalCount(res.totalCount ?? res.items?.length ?? 0)
    } catch {
      setItems([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const goToAll = () => router.push("/notifications")

  const formatTime = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "short", day: "numeric" }).format(d)
  }

  const badge = totalCount > 9 ? "9+" : String(totalCount)

  return (
    <DropdownMenu onOpenChange={open => open && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t("common.notifications.title")}
          aria-label={t("common.notifications.title")}
          className="relative size-9 text-muted-foreground"
        >
          <Bell className="size-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">{t("common.notifications.title")}</span>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("common.notifications.empty")}
            </div>
          ) : (
            items.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={goToAll}
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-start transition-colors hover:bg-muted/60"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(n.creationTime)}</span>
                </div>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
              </button>
            ))
          )}
        </div>

        <div className={cn("border-t border-border p-1.5")}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sm font-medium text-primary"
            onClick={goToAll}
          >
            {t("common.notifications.show_all")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
