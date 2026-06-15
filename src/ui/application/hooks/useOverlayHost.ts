"use client"

import { useContext } from "react"
import { OverlayHostContext, type OverlayHostContextValue } from "../contexts/OverlayHostContext"

/**
 * Subscribe to the nearest `OverlayHostProvider`. Throws when called
 * outside one — the alternative (returning undefined) defers the failure
 * to the first `openDialog` call and produces a less actionable stack.
 */
export function useOverlayHost(): OverlayHostContextValue {
  const ctx = useContext(OverlayHostContext)
  if (!ctx) {
    throw new Error("useOverlayHost() must be used inside an <OverlayHostProvider>")
  }
  return ctx
}
