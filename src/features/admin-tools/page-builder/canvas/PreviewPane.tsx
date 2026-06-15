"use client"

/**
 * Preview pane — wraps `PageRenderer` with the toggles a designer
 * typically wants: locale (EN ↔ AR), theme (light ↔ dark), and viewport
 * (desktop / tablet / mobile).
 *
 * The preview mounts a `PageBuilderRenderProvider` so
 * block renderers downstream can read the active locale and pick up
 * inline-edit affordances. The runtime route stays untouched — it
 * doesn't mount the provider and therefore picks the defaults
 * (`isEditing: false`, `locale: "en"`).
 *
 * `onUpdateBlock` is forwarded from the canvas as the bridge to
 * `useCanvasState.updateBlockById`. Each inline commit looks up the
 * current block, patches the field, and dispatches the update — which
 * itself routes through `commit()` for one history entry per edit
 * session.
 */

import { useCallback, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Monitor, Tablet, Smartphone, Languages, SunMoon } from "lucide-react"
import { PageRenderer } from "../renderer/PageRenderer"
import { PageBuilderRenderProvider, type RenderLocale } from "../renderer/PageBuilderRenderContext"
import { findBlockById } from "./tree"
import { setDeep } from "./utils/set-deep"
import type { PageSchema } from "../schema/page-schema"
import type { BlockSchema } from "../schema/block-schema"

type Theme = "light" | "dark"
type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
}

export interface PreviewPaneProps {
  schema: PageSchema
  /** When provided, the preview enables inline editing and routes
   * commits through this callback (typically `state.updateBlockById`). */
  onUpdateBlock?: (id: string, next: BlockSchema) => void
}

export function PreviewPane({ schema, onUpdateBlock }: PreviewPaneProps) {
  const [locale, setLocale] = useState<RenderLocale>("en")
  const [theme, setTheme] = useState<Theme>("light")
  const [viewport, setViewport] = useState<Viewport>("desktop")

  const handleEditField = useCallback(
    (blockId: string, fieldKey: string, value: { en: string; ar: string }) => {
      if (!onUpdateBlock) return
      const found = findBlockById(schema, blockId)
      if (!found) return
      // `fieldKey` is a dot-path so we can address nested LocalizedString
      // fields like `button.label`, `tabs.0.label`, `items.2.title`
      // without per-block bridging code.
      const nextBlock = setDeep(found.block, fieldKey, value)
      onUpdateBlock(blockId, nextBlock as BlockSchema)
    },
    [schema, onUpdateBlock],
  )

  const inlineEditingEnabled = Boolean(onUpdateBlock)

  return (
    <div className="space-y-3" data-testid="preview-pane">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLocale(l => (l === "en" ? "ar" : "en"))}
          data-testid="preview-toggle-locale"
        >
          <Languages className="me-1 h-4 w-4" />
          {locale.toUpperCase()}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}
          data-testid="preview-toggle-theme"
        >
          <SunMoon className="me-1 h-4 w-4" />
          {theme}
        </Button>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={viewport === "desktop" ? "default" : "outline"}
            onClick={() => setViewport("desktop")}
            data-testid="preview-viewport-desktop"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={viewport === "tablet" ? "default" : "outline"}
            onClick={() => setViewport("tablet")}
            data-testid="preview-viewport-tablet"
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={viewport === "mobile" ? "default" : "outline"}
            onClick={() => setViewport("mobile")}
            data-testid="preview-viewport-mobile"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div
          className={theme === "dark" ? "dark" : ""}
          style={{ maxWidth: VIEWPORT_WIDTH[viewport], margin: "0 auto" }}
          dir={locale === "ar" ? "rtl" : "ltr"}
          data-testid="preview-frame"
          data-preview-locale={locale}
          data-preview-theme={theme}
          data-preview-viewport={viewport}
        >
          <div className="rounded border border-border bg-background p-4">
            <PageBuilderRenderProvider
              locale={locale}
              isEditing={inlineEditingEnabled}
              onEditField={inlineEditingEnabled ? handleEditField : undefined}
            >
              <PageRenderer schema={schema} />
            </PageBuilderRenderProvider>
          </div>
        </div>
      </div>
    </div>
  )
}
