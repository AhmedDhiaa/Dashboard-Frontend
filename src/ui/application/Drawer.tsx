/**
 * ADVANCED DRAWER COMPONENT
 *
 * Features:
 * - RTL support: Opens from LEFT for Arabic, RIGHT for English
 * - Multiple modes: overlay, push, hybrid
 * - Fully configurable
 * - Clean separation from business logic
 * - Uses global design system
 *
 * @strict @enterprise-grade
 */

"use client"

import { useEffect, useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useDrawer } from "@/ui/application/contexts/DrawerContext"
import { useLocale } from "next-intl"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

export function Drawer() {
  const { isOpen, content, title, config, closeDrawer } = useDrawer()
  const locale = useLocale()
  const t = useT("common")

  // Determine drawer direction based on locale and config
  const direction = useMemo(() => {
    if (config.direction === "auto") {
      // RTL languages open from LEFT, LTR languages from RIGHT
      return locale === "ar" ? "left" : "right"
    }
    return config.direction || "right"
  }, [config.direction, locale])

  // Close drawer on escape key
  useEffect(() => {
    if (!config.closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeDrawer()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, closeDrawer, config.closeOnEscape])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen && config.mode === "overlay") {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen, config.mode])

  // Calculate transform classes
  const transformClasses = useMemo(() => {
    if (!isOpen) {
      return direction === "left" ? "-translate-x-full" : "translate-x-full"
    }
    return "translate-x-0"
  }, [isOpen, direction])

  // Position classes
  const positionClasses = useMemo(() => {
    return direction === "left" ? "left-0 end-0" : "right-0 end-0"
  }, [direction])

  return (
    <>
      {/* Backdrop */}
      {config.backdrop && (
        <div
          className={cn(
            "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-50",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={config.closeOnBackdrop ? closeDrawer : undefined}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 h-full bg-card border shadow-2xl transform transition-all duration-300 ease-in-out z-[51]",
          "flex flex-col",
          positionClasses,
          transformClasses,
          direction === "left" ? "border-e" : "border-s",
        )}
        style={{ width: config.width || "28rem" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-gradient-to-r from-muted/30 to-muted/10 flex-shrink-0">
          <h2 id="drawer-title" className="text-lg font-semibold text-foreground flex-1 min-w-0 truncate">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={closeDrawer}
            className="flex-shrink-0"
            aria-label={t("drawer.close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">{content}</div>
      </aside>

      {/* Push Mode Spacer */}
      {config.mode === "push" && isOpen && (
        <div
          className="fixed inset-y-0 z-40"
          style={{
            width: config.width || "28rem",
            [direction === "left" ? "left" : "right"]: 0,
          }}
        />
      )}
    </>
  )
}
