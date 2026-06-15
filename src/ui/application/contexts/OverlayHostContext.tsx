"use client"

/**
 * OverlayHostContext — central host for imperatively-opened dialogs and
 * drawers anywhere in the dashboard tree.
 *
 * Two surfaces:
 *   - `openDialog({ title, content, size?, onClose? })` mounts a Radix
 *     `<Dialog>` in the centre of the viewport.
 *   - `openDrawer({ title, content, side?, onClose? })` mounts a Radix
 *     `<Sheet>` slide-in from one of four edges. The `side` argument
 *     uses logical names (`start | end | top | bottom`) and the host
 *     translates `start`/`end` to physical `left`/`right` based on the
 *     active locale (`ar` → reversed).
 *
 * Both calls return an opaque id. `closeOverlay(id)` removes the matching
 * overlay; `closeAll()` clears the stack. Multiple overlays may coexist
 * (e.g. an action button inside a drawer that opens a confirm dialog) —
 * each renders in its own portal.
 *
 * Lives next to (not inside) the existing `DrawerProvider`. The legacy
 * drawer is a single-slot, left/right-only host kept for `FilterDrawer`;
 * this host supports stacking + 4-sided sheets and is the surface the
 * Page Builder action executor uses for `dialog` / `drawer` actions.
 */

import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { useLocale } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/design-system/primitives/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/ui/design-system/primitives/sheet"
import { cn } from "@/shared/utils"

export type OverlaySide = "start" | "end" | "top" | "bottom"
export type OverlaySize = "sm" | "md" | "lg" | "full"

export interface OverlayDialogOptions {
  title?: ReactNode
  content: ReactNode
  size?: OverlaySize
  onClose?: () => void
}

export interface OverlayDrawerOptions {
  title?: ReactNode
  content: ReactNode
  side?: OverlaySide
  onClose?: () => void
}

export interface OverlayHostContextValue {
  openDialog: (opts: OverlayDialogOptions) => string
  openDrawer: (opts: OverlayDrawerOptions) => string
  closeOverlay: (id: string) => void
  closeAll: () => void
}

interface DialogItem {
  id: string
  title: ReactNode | undefined
  content: ReactNode
  size: OverlaySize
}

interface DrawerItem {
  id: string
  title: ReactNode | undefined
  content: ReactNode
  side: OverlaySide
}

export const OverlayHostContext = createContext<OverlayHostContextValue | null>(null)

const SIZE_CLASS: Record<OverlaySize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  full: "max-w-[95vw]",
}

let counter = 0
function generateId(): string {
  counter += 1
  return `overlay-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Translate a logical `OverlaySide` to a physical Sheet side. The Sheet
 * primitive only knows `left | right | top | bottom`, so RTL flipping
 * happens here exactly once.
 */
export function resolveSheetSide(side: OverlaySide, isRTL: boolean): "left" | "right" | "top" | "bottom" {
  if (side === "top" || side === "bottom") return side
  if (isRTL) return side === "start" ? "right" : "left"
  return side === "start" ? "left" : "right"
}

export function OverlayHostProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogItem[]>([])
  const [drawers, setDrawers] = useState<DrawerItem[]>([])
  // Keep onClose callbacks outside React state — they don't drive render
  // and storing them in state would force every open call to rebuild the
  // memoised context value.
  const onCloseRef = useRef<Record<string, (() => void) | undefined>>({})
  const locale = useLocale()
  const isRTL = locale === "ar"

  const openDialog = useCallback((opts: OverlayDialogOptions): string => {
    const id = generateId()
    if (opts.onClose) onCloseRef.current[id] = opts.onClose
    setDialogs(prev => [...prev, { id, title: opts.title, content: opts.content, size: opts.size ?? "md" }])
    return id
  }, [])

  const openDrawer = useCallback((opts: OverlayDrawerOptions): string => {
    const id = generateId()
    if (opts.onClose) onCloseRef.current[id] = opts.onClose
    setDrawers(prev => [...prev, { id, title: opts.title, content: opts.content, side: opts.side ?? "end" }])
    return id
  }, [])

  const closeOverlay = useCallback((id: string) => {
    const cb = onCloseRef.current[id]
    delete onCloseRef.current[id]
    setDialogs(prev => prev.filter(d => d.id !== id))
    setDrawers(prev => prev.filter(d => d.id !== id))
    cb?.()
  }, [])

  const closeAll = useCallback(() => {
    const callbacks = Object.values(onCloseRef.current)
    onCloseRef.current = {}
    setDialogs([])
    setDrawers([])
    callbacks.forEach(cb => cb?.())
  }, [])

  const value = useMemo<OverlayHostContextValue>(
    () => ({ openDialog, openDrawer, closeOverlay, closeAll }),
    [openDialog, openDrawer, closeOverlay, closeAll],
  )

  return (
    <OverlayHostContext.Provider value={value}>
      {children}
      {dialogs.map(d => (
        <Dialog key={d.id} open onOpenChange={open => !open && closeOverlay(d.id)}>
          <DialogContent
            className={cn(SIZE_CLASS[d.size])}
            data-overlay-id={d.id}
            data-testid={`overlay-dialog-${d.id}`}
          >
            {d.title !== undefined && (
              <DialogHeader>
                <DialogTitle>{d.title}</DialogTitle>
              </DialogHeader>
            )}
            {d.content}
          </DialogContent>
        </Dialog>
      ))}
      {drawers.map(d => {
        const physicalSide = resolveSheetSide(d.side, isRTL)
        return (
          <Sheet key={d.id} open onOpenChange={open => !open && closeOverlay(d.id)}>
            <SheetContent
              side={physicalSide}
              data-overlay-id={d.id}
              data-overlay-side={physicalSide}
              data-overlay-logical-side={d.side}
              data-testid={`overlay-drawer-${d.id}`}
            >
              {d.title !== undefined && (
                <SheetHeader>
                  <SheetTitle>{d.title}</SheetTitle>
                </SheetHeader>
              )}
              {d.content}
            </SheetContent>
          </Sheet>
        )
      })}
    </OverlayHostContext.Provider>
  )
}
