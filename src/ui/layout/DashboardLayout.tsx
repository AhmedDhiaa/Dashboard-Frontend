"use client"

import { ReactNode, Suspense } from "react"
import { LayoutProvider, useLayout } from "./LayoutContext"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { RouteProgress } from "./RouteProgress"
import { DrawerProvider } from "@/ui/application/contexts/DrawerContext"
import { OverlayHostProvider } from "@/ui/application/contexts/OverlayHostContext"
import dynamic from "next/dynamic"

// Lazy load heavy UI components to improve initial bundle size and load speed.
// The theme customizer no longer mounts a floating launcher here — all theme
// editing now lives in the unified Theme Studio at /admin/theme.
const Drawer = dynamic(() => import("@/ui/application/Drawer").then(mod => mod.Drawer), {
  ssr: false,
})

interface DashboardLayoutProps {
  children: ReactNode
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { locale } = useLayout()
  const isRTL = locale === "ar"

  return (
    <DrawerProvider>
      <OverlayHostProvider>
        {/* App shell — a flex ROW: the sidebar takes its own (content-sized)
            width and the main column fills the rest. Because the two are flex
            siblings, the page always sits flush beside the sidebar — no gap,
            no overlap — at any sidebar width and in both LTR and RTL. */}
        <div dir={isRTL ? "rtl" : "ltr"} className="h-screen overflow-hidden flex bg-background">
          <RouteProgress />
          <Sidebar />

          {/* Main column — fills the remaining width. `min-w-0` lets it shrink
              so wide content (tables) scrolls internally instead of pushing
              the layout. */}
          <div className="flex flex-1 min-w-0 flex-col">
            <Header />

            <main id="main-content" className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Inner content well — the scroll container. `flex-1 min-h-0`
                  fills the column; `overflow-y-auto` scrolls tall content while
                  a full-height child (a list page) fits exactly and lets its own
                  table body scroll internally. Symmetric, responsive padding. */}
              <div className="flex w-full flex-1 min-h-0 flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>

          {/* Component loading boundary */}
          <Suspense fallback={null}>
            {/* Drawer Component - Lazy loaded */}
            <Drawer />
          </Suspense>
        </div>
      </OverlayHostProvider>
    </DrawerProvider>
  )
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <LayoutProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </LayoutProvider>
  )
}
