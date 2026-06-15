"use client"

/**
 * Floating pencil that follows the hovered text node when edit mode is on.
 *
 * Detection strategy:
 *   - Listen to mousemove on document.body
 *   - Find the closest leaf element whose direct text content matches a key
 *     in the textIndex
 *   - If 1+ keys match, position the pencil over the element and store the
 *     candidate keys; clicking the pencil opens the panel for the first
 *     candidate (multi-match disambiguation is a future iteration)
 *
 * The pencil itself is one fixed-position button — no per-element overlays,
 * which would be expensive on dense pages.
 *
 * Two subtleties that previously made the pencil un-clickable (now fixed):
 *   1. Moving the cursor ONTO the pencil fires a mousemove whose target is the
 *      pencil itself. The old code cleared `pos` for any non-indexed target,
 *      so the pencil unmounted the instant you reached it. We now KEEP the
 *      pencil whenever the cursor is over the editor's own UI.
 *   2. There is a small gap between the text and the pencil; crossing it lands
 *      on a non-indexed parent. Instead of hiding immediately we hide on a
 *      short grace timer, cancelled as soon as the cursor reaches the pencil.
 *   3. The dashboard scrolls inside <main>, not <body>, so absolute+scrollY
 *      math was wrong. The pencil is now `position: fixed` in viewport coords.
 */

import { useEffect, useRef, useState } from "react"
import { Pencil } from "lucide-react"
import { useTranslationEditor } from "../TranslationEditorContext"
import type { KeyDescriptor } from "../types"

interface PencilPosition {
  top: number
  left: number
  candidates: KeyDescriptor[]
}

const MAX_TEXT_LENGTH = 400
// How long the pencil lingers after the cursor leaves matched text, giving
// the user time to travel the few px from the text to the pencil button.
const HIDE_GRACE_MS = 280

export function EditOverlay(): React.ReactNode {
  const { enabled, callIndex, textIndex, edit } = useTranslationEditor()
  const [pos, setPos] = useState<PencilPosition | null>(null)
  // Hold the latest indices in refs so the body listener (registered once)
  // always sees current data without re-binding on every index bump.
  const callIndexRef = useRef(callIndex)
  const textIndexRef = useRef(textIndex)
  callIndexRef.current = callIndex
  textIndexRef.current = textIndex
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPos(null)
      return
    }

    let raf = 0
    const cancelHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
    const scheduleHide = () => {
      if (hideTimer.current) return
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null
        setPos(null)
      }, HIDE_GRACE_MS)
    }

    function handleMove(event: MouseEvent) {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const target = event.target as HTMLElement | null
        if (!target || !(target instanceof HTMLElement)) {
          scheduleHide()
          return
        }
        // Cursor is over the pencil or the side panel — keep the current
        // pencil mounted so it stays clickable.
        if (target.closest("[data-translation-editor-ui='1']")) {
          cancelHide()
          return
        }
        const text = (target.textContent ?? "").trim()
        if (!text || text.length > MAX_TEXT_LENGTH) {
          scheduleHide()
          return
        }
        const flatKeys = textIndexRef.current.get(text)
        if (!flatKeys || flatKeys.size === 0) {
          scheduleHide()
          return
        }
        const candidates: KeyDescriptor[] = []
        for (const flatKey of flatKeys) {
          const record = callIndexRef.current.get(flatKey)
          if (record) {
            candidates.push({
              namespace: record.namespace,
              keyPath: record.keyPath,
              flatKey: record.flatKey,
            })
          }
        }
        if (candidates.length === 0) {
          scheduleHide()
          return
        }
        cancelHide()
        const rect = target.getBoundingClientRect()
        // Fixed positioning → viewport coordinates (no scroll offset). Clamp
        // into the viewport so the pencil never lands off-screen at the edges.
        const top = Math.min(Math.max(rect.top - 2, 4), window.innerHeight - 28)
        const left = Math.min(Math.max(rect.right + 4, 4), window.innerWidth - 28)
        setPos({ top, left, candidates })
      })
    }

    document.body.addEventListener("mousemove", handleMove)
    return () => {
      document.body.removeEventListener("mousemove", handleMove)
      cancelAnimationFrame(raf)
      cancelHide()
    }
  }, [enabled])

  if (!enabled || !pos) return null

  return (
    <button
      type="button"
      data-translation-editor-ui="1"
      onClick={e => {
        e.stopPropagation()
        e.preventDefault()
        if (pos.candidates[0]) edit(pos.candidates[0])
      }}
      title={
        pos.candidates.length === 1
          ? `Edit ${pos.candidates[0]!.flatKey}`
          : `Edit ${pos.candidates[0]!.flatKey} (+${pos.candidates.length - 1} other matches)`
      }
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
      className="rounded-full bg-primary text-primary-foreground p-1.5 shadow-md ring-2 ring-background hover:scale-110 transition-transform cursor-pointer"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  )
}
