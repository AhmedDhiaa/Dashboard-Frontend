"use client"

/**
 * Render-time context shared by every block render and the inline
 * editing primitives.
 *
 * Defaults to `{ locale: "en", isEditing: false }`, so the production
 * runtime route (`/pages/[pageId]`) — which does NOT mount a provider —
 * gets a fully read-only, EN-locale render. The canvas's `PreviewPane`
 * wraps `PageRenderer` in a provider that flips `isEditing` to `true`
 * and threads the preview's locale toggle, plus a commit callback that
 * bridges back to `useCanvasState.updateBlockById`.
 *
 * `useLocalizedText` exists so block renderers can stop hardcoding
 * `.en`. The fallback chain is `locale → .en → ""` to stay safe with
 * partially-populated LocalizedString fields (e.g. fresh blocks before
 * the AR copy is filled in).
 */

import { createContext, useContext, type ReactNode } from "react"

export type RenderLocale = "en" | "ar"

export interface PageBuilderRenderContextValue {
  /** Active locale for rendering LocalizedString values. */
  locale: RenderLocale

  /** True when the renderer should expose inline editing affordances. */
  isEditing: boolean

  /**
   * Called when an inline edit commits. The path identifies the block,
   * the field key identifies which LocalizedString (e.g. "text", "label",
   * "title"), and value is the new LocalizedString.
   *
   * Only set when isEditing === true.
   */
  onEditField?: (blockId: string, fieldKey: string, value: { en: string; ar: string }) => void
}

const DEFAULT_VALUE: PageBuilderRenderContextValue = {
  locale: "en",
  isEditing: false,
}

const PageBuilderRenderContext = createContext<PageBuilderRenderContextValue>(DEFAULT_VALUE)

export interface PageBuilderRenderProviderProps {
  children: ReactNode
  locale?: RenderLocale
  isEditing?: boolean
  onEditField?: PageBuilderRenderContextValue["onEditField"]
}

export function PageBuilderRenderProvider({
  children,
  locale = "en",
  isEditing = false,
  onEditField,
}: PageBuilderRenderProviderProps) {
  return (
    <PageBuilderRenderContext.Provider value={{ locale, isEditing, onEditField }}>
      {children}
    </PageBuilderRenderContext.Provider>
  )
}

export function usePageBuilderRender(): PageBuilderRenderContextValue {
  return useContext(PageBuilderRenderContext)
}

/**
 * Helper: read a LocalizedString in the active locale, with .en fallback.
 * Returns "" when the input is undefined so callers can render directly
 * without a guard.
 */
export function useLocalizedText(localized: { en: string; ar: string } | undefined): string {
  const { locale } = usePageBuilderRender()
  if (!localized) return ""
  return localized[locale] || localized.en || ""
}
