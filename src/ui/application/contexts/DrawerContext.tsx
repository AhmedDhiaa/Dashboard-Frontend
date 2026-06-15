"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

/**
 * ADVANCED DRAWER CONTEXT - PROFESSIONAL & DYNAMIC
 *
 * Features:
 * - RTL/LTR direction support (auto-detects language)
 * - Overlay mode (drawer floats above content)
 * - Push mode (drawer pushes content)
 * - Hybrid mode (configurable)
 * - Fully reusable and configurable
 *
 * @strict @enterprise-grade
 */

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from "react"

export type DrawerMode = "overlay" | "push" | "hybrid"
export type DrawerDirection = "left" | "right" | "auto"

interface DrawerConfig {
  mode?: DrawerMode
  direction?: DrawerDirection
  width?: string
  backdrop?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

interface DrawerContextType {
  isOpen: boolean
  content: ReactNode | null
  title: string
  config: DrawerConfig
  openDrawer: (content: ReactNode, title?: string, config?: DrawerConfig) => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined)

const defaultConfig: DrawerConfig = {
  mode: "overlay",
  direction: "auto",
  width: "28rem",
  backdrop: true,
  closeOnBackdrop: true,
  closeOnEscape: true,
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState<ReactNode | null>(null)
  const [title, setTitle] = useState<string>("")
  const [config, setConfig] = useState<DrawerConfig>(defaultConfig)

  const openDrawer = useCallback(
    (drawerContent: ReactNode, drawerTitle: string = "", drawerConfig: DrawerConfig = {}) => {
      setContent(drawerContent)
      setTitle(drawerTitle)
      setConfig({ ...defaultConfig, ...drawerConfig })
      setIsOpen(true)
    },
    [],
  )

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    // Delay clearing content to allow animation to complete
    setTimeout(() => {
      setContent(null)
      setTitle("")
      setConfig(defaultConfig)
    }, 300)
  }, [])

  const toggleDrawer = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const value = useMemo(
    () => ({
      isOpen,
      content,
      title,
      config,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [isOpen, content, title, config, openDrawer, closeDrawer, toggleDrawer],
  )

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

export function useDrawer() {
  const context = useContext(DrawerContext)
  if (context === undefined) {
    throw new Error("useDrawer must be used within a DrawerProvider")
  }
  return context
}
