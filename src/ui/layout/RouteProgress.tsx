"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/shared/utils"

/** A click with a modifier / non-primary button opens a new tab — not an SPA nav. */
function isModifiedClick(e: MouseEvent): boolean {
  return e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}

function safeUrl(href: string): URL | null {
  try {
    return new URL(href, window.location.href)
  } catch {
    return null
  }
}

/** True when the click is an internal navigation to a *different* pathname. */
function isInternalNavClick(e: MouseEvent): boolean {
  if (isModifiedClick(e)) return false
  const anchor = (e.target as HTMLElement | null)?.closest("a")
  if (!anchor) return false
  const target = anchor.getAttribute("target")
  if (target && target !== "_self") return false
  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#")) return false
  const url = safeUrl(href)
  return !!url && url.origin === window.location.origin && url.pathname !== window.location.pathname
}

/**
 * Thin top route-progress bar (nprogress-style), dependency-free.
 *
 * Starts when an internal link to a different pathname is clicked (capture-phase
 * click listener — covers the sidebar, breadcrumbs, tables, etc.) and completes
 * when `usePathname()` settles on the new route. Programmatic `router.push`
 * navigations don't start the bar (no flash), which is intentional.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearTimers = () => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      if (hideRef.current) {
        clearTimeout(hideRef.current)
        hideRef.current = null
      }
    }

    const start = () => {
      clearTimers()
      activeRef.current = true
      setActive(true)
      setProgress(8)
      // Ease toward 90% while we wait for the new route to render.
      tickRef.current = setInterval(() => {
        setProgress(p => (p < 90 ? p + (90 - p) * 0.12 : p))
      }, 180)
    }

    const onClick = (e: MouseEvent) => {
      if (isInternalNavClick(e)) start()
    }

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      clearTimers()
    }
  }, [])

  // Complete the bar once the new pathname has settled.
  useEffect(() => {
    if (!activeRef.current) return
    activeRef.current = false
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    setProgress(100)
    hideRef.current = setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 250)
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="h-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%`, boxShadow: "0 0 8px var(--primary)" }}
      />
    </div>
  )
}
