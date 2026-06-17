"use client"

import { Menu, X, Globe, Sun, Moon, ChevronDown, Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import { Avatar, AvatarFallback } from "@/ui/design-system/primitives/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/shared/utils"
import { getInitials } from "@/shared/utils/avatar"
import { useLayout } from "./LayoutContext"
import { useT } from "@/shared/config"
import { NAV_GROUPS } from "@/shared/config/navigation"
import { isPathActive } from "@/shared/utils"
import { useMemo } from "react"
import dynamic from "next/dynamic"

// Lazy-load to avoid pulling the editor's API client + state machine into
// the dashboard's initial bundle for non-admin users (the toggle renders
// nothing for them anyway).
const EditModeToggle = dynamic(() => import("@/features/admin-tools/translation-editor").then(m => m.EditModeToggle), {
  ssr: false,
})

// Notification bell — lazy so the notification domain service stays out of the
// header's initial chunk for users who never open it. Replaces the old
// builder-controls wrench in the header.
const NotificationBell = dynamic(() => import("@/features/notifications").then(m => m.NotificationBell), {
  ssr: false,
})

// eslint-disable-next-line complexity, max-lines-per-function -- Header with dynamic page title, user menu, theme toggle, and language switcher
export function Header() {
  const { data: session } = useSession()
  const t = useT()
  const pathname = usePathname()
  const {
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    theme,
    setTheme,
    locale,
    setLocale,
    isLocaleChanging,
    pageTitle,
    pageDescription,
  } = useLayout()

  const isRTL = locale === "ar"

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  const switchLanguage = () => {
    const newLocale = locale === "en" ? "ar" : "en"
    setLocale(newLocale)
  }

  const router = useRouter()

  const handleLogout = () => {
    // Optimistic signout: navigate to login immediately so the user sees the
    // login page at once. signOut fires in the background to clear the
    // HttpOnly session cookie server-side.
    router.push("/auth/login")
    signOut({ redirect: false }).catch(() => {
      /* silently ignore */
    })
  }

  // Normalize pathname for comparisons
  const cleanPathname = useMemo(() => pathname.replace(/^\/(en|ar)(\/|$)/, "/"), [pathname])

  // Find active group and item for fallback if no pageTitle is set
  const activeInfo = useMemo(() => {
    // 1. Exact match first (on cleaned path)
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.href === cleanPathname) {
          return { groupTitle: t(group.titleKey), itemTitle: t(item.titleKey), Icon: group.icon }
        }
        const activeSub = item.subItems?.find(sub => sub.href === cleanPathname)
        if (activeSub) {
          return { groupTitle: t(group.titleKey), itemTitle: t(activeSub.titleKey), Icon: group.icon }
        }
      }
    }

    // 2. Fuzzy match (starts-with) for detail pages
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (isPathActive(pathname, item.href)) {
          return { groupTitle: t(group.titleKey), itemTitle: t(item.titleKey), Icon: group.icon }
        }
        const activeSub = item.subItems?.find(sub => isPathActive(pathname, sub.href))
        if (activeSub) {
          return { groupTitle: t(group.titleKey), itemTitle: t(activeSub.titleKey), Icon: group.icon }
        }
      }
    }

    return cleanPathname === "/" && NAV_GROUPS[0]
      ? { groupTitle: t("nav.overview"), itemTitle: t("nav.dashboard"), Icon: NAV_GROUPS[0].icon }
      : null
  }, [pathname, cleanPathname, t])

  // Determine final display titles
  const displayTitle = pageTitle || activeInfo?.itemTitle || ""
  const displaySubtitle = pageDescription || activeInfo?.groupTitle || ""
  const Icon = activeInfo?.Icon

  const userName = session?.user?.name || t("common.app.name")
  // ... rest of logic remains same
  const userEmail = session?.user?.email || "admin@acme.com"
  const userInitials = getInitials(userName)

  return (
    <header className="relative z-10 shrink-0 bg-card border-b border-border">
      {/* App top bar. A normal (non-fixed) flex item at the top of the main
          column — it sits flush against the sidebar with no manual offset, and
          the content well below scrolls independently beneath it. */}
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Start Section — mobile menu + breadcrumb (compact). The page
            title itself lives inside each page (CRUDListPage's
            DataTableHeader, CRUDEditPage's CardHeader) so it doesn't
            double-up here. The breadcrumb tells the user "where am I in
            the nav tree?" without competing with the page-level H1. */}
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 shrink-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={t("nav.a11y.toggle_menu")}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {displayTitle && (
            <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              {Icon && (
                <span className="hidden sm:flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary shrink-0">
                  <Icon className="size-3.5" />
                </span>
              )}
              {displaySubtitle && (
                <>
                  <span className="hidden sm:inline text-muted-foreground truncate max-w-truncate-small">
                    {displaySubtitle}
                  </span>
                  <span className="hidden sm:inline text-muted-foreground/40 select-none shrink-0" aria-hidden="true">
                    {isRTL ? "‹" : "›"}
                  </span>
                </>
              )}
              <span className="font-medium text-foreground truncate">{displayTitle}</span>
            </nav>
          )}
        </div>

        {/* End Section — controls + user menu */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={switchLanguage}
            disabled={isLocaleChanging}
            title={t("common.language.switch")}
            className="h-9 px-2.5 gap-1.5 text-muted-foreground"
          >
            {isLocaleChanging ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
            <span className="text-xs font-medium uppercase">{locale === "en" ? "AR" : "EN"}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={t("common.theme.toggle")}
            className="size-9 text-muted-foreground"
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>

          <NotificationBell />

          <div className="h-5 w-px bg-border mx-1.5 shrink-0" aria-hidden="true" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* Trigger: avatar + name only (email moved into the menu
                  header below). Keeping the trigger tight stops it from
                  competing with the page title block at the other edge
                  of the bar at every viewport width. */}
              <Button variant="ghost" className="h-9 gap-2 px-1.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="flex items-center justify-center h-full w-full bg-primary text-primary-foreground text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-xs font-medium text-foreground leading-tight max-w-[8rem] truncate">
                  {userName}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-60">
              {/* Menu header: name + email together as a single stack so
                  the trigger can stay compact in the top bar. */}
              <div className="px-2.5 py-2 flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="flex items-center justify-center h-full w-full bg-primary text-primary-foreground text-xs font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground leading-tight truncate">{userName}</span>
                  <span className="text-xs text-muted-foreground leading-tight truncate">{userEmail}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings/profile")}
                className={cn("gap-2", isRTL && "flex-row-reverse")}
              >
                <span>{t("nav.profile")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className={cn("gap-2", isRTL && "flex-row-reverse")}
              >
                <span>{t("nav.settings")}</span>
              </DropdownMenuItem>
              <EditModeToggle className={cn(isRTL && "flex-row-reverse")} />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className={cn(
                  "gap-2 text-destructive focus:text-destructive focus:bg-destructive/10",
                  isRTL && "flex-row-reverse",
                )}
              >
                <span>{t("nav.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
