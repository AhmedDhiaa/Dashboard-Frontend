"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getSavedTheme, saveTheme, applyTheme, getSystemTheme } from "@/ui/theme/theme-service"
import { type Locale, persistLocale, useLocale } from "@/shared/config"
import { logger } from "@/shared/logger"

interface LayoutContextType {
  // Sidebar state
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (collapsed: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void

  // Theme state
  theme: "light" | "dark"
  setTheme: (theme: "light" | "dark") => void

  // Language state
  locale: Locale
  setLocale: (locale: Locale) => void
  direction: "ltr" | "rtl"
  isLocaleChanging: boolean

  // Page Metadata
  pageTitle: string | null
  setPageTitle: (title: string | null) => void
  pageDescription: string | null
  setPageDescription: (description: string | null) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider")
  }
  return context
}

/**
 * Hook to handle responsive sidebar behavior on window resize
 */
function useResponsiveSidebar() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      window.requestAnimationFrame(() => {
        const width = window.innerWidth
        if (width < 1280 && width >= 1024) {
          setIsSidebarCollapsed(true)
        } else if (width >= 1280) {
          setIsSidebarCollapsed(false)
        }

        if (width >= 1024) {
          setIsMobileMenuOpen(false)
        }
      })
    }

    handleResize()

    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 100)
    }

    window.addEventListener("resize", debouncedResize)
    return () => {
      window.removeEventListener("resize", debouncedResize)
      clearTimeout(timeoutId)
    }
  }, [])

  return {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  }
}

interface LayoutProviderProps {
  children: ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const { locale } = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Page Metadata
  const [pageTitle, setPageTitle] = useState<string | null>(null)
  const [pageDescription, setPageDescription] = useState<string | null>(null)

  const { isSidebarCollapsed, setIsSidebarCollapsed, isMobileMenuOpen, setIsMobileMenuOpen } = useResponsiveSidebar()

  // Initialize theme from localStorage using lazy initializer
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    try {
      const savedTheme = getSavedTheme()
      if (savedTheme === "system" || !savedTheme) {
        return getSystemTheme()
      }
      return savedTheme
    } catch (error) {
      logger.error("Failed to initialize theme", error)
      return "light"
    }
  })

  // Apply theme to DOM on mount and when theme changes
  useEffect(() => {
    applyTheme(theme)
    const savedTheme = getSavedTheme()
    if (savedTheme === "system" || !savedTheme) {
      saveTheme("system")
    }
  }, [theme])

  const setTheme = useCallback((newTheme: "light" | "dark") => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    saveTheme(newTheme)
  }, [])

  const setLocale = useCallback(
    (newLocale: Locale) => {
      // Persist BEFORE the refresh so the server-side getRequestConfig (which
      // reads the cookie to choose the namespace bundle) sees the new locale
      // when Next re-fetches the current route's RSC payload.
      persistLocale(newLocale)

      // Soft refresh the current route. NextIntlClientProvider re-receives
      // the new messages from the regenerated RSC tree; client component
      // state (sidebar, dropdowns, scroll, in-progress form data, modal
      // context) is preserved. The startTransition wrapper exposes the
      // refresh as `isLocaleChanging` so the UI can show a subtle pending
      // indicator without blocking.
      startTransition(() => {
        router.refresh()
      })
    },
    [router],
  )

  // Memoize the context value to prevent unnecessary re-renders of consuming components
  const value: LayoutContextType = useMemo(
    () => ({
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      theme,
      setTheme,
      locale,
      setLocale,
      direction: locale === "ar" ? "rtl" : "ltr",
      isLocaleChanging: isPending,
      pageTitle,
      setPageTitle,
      pageDescription,
      setPageDescription,
    }),
    [
      isSidebarCollapsed,
      isMobileMenuOpen,
      theme,
      setTheme,
      locale,
      setLocale,
      isPending,
      pageTitle,
      pageDescription,
      setIsMobileMenuOpen,
      setIsSidebarCollapsed,
    ],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}
