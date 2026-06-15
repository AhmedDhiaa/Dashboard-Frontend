"use client"

/**
 * Page Builder canvas — the editor shell.
 *
 * Layout (Phase 4 MVP):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  Header  Save | Discard | Preview | Materi…  │
 *   ├────────┬───────────────────────────┬─────────┤
 *   │ Pale-  │  Block list +             │  Props  │
 *   │  tte   │  Preview (live)           │  panel  │
 *   └────────┴───────────────────────────┴─────────┘
 *
 * Drag-drop:
 *   - Palette items expose `dataTransfer["application/page-builder-block-type"]`.
 *   - The canvas drop zone reads it and dispatches `addBlock` with a clone
 *     of the block definition's `defaultProps` (a fresh `id` is patched in
 *     so multiple instances don't collide).
 *
 * State: lifts to `useCanvasState` — the canvas itself is presentational.
 *
 * Materialize: disabled per Phase 4 spec; tooltip explains it lands in
 * Phase 7.
 */

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, FileCode2, Save, Trash2, Wrench } from "lucide-react"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { useNotification } from "@/ui/application/hooks/useNotification"
import { useCanvasState } from "./hooks/useCanvasState"
import { useMaterializePage, type MaterializeResult } from "./hooks/useMaterializePage"
import { useSavePage } from "./hooks/useSavePage"
import { PAGE_BUILDER_DRAG_TYPE } from "./BlockPalette"
import { PropertiesPanel } from "./PropertiesPanel"
import { PreviewPane } from "./PreviewPane"
import { SwaggerWizard } from "./SwaggerWizard"
import { LayersPalettePanel } from "./components/LayersPalettePanel"
import { instantiateBlock } from "./utils/instantiateBlock"
import type { PageSchema } from "../schema/page-schema"

const MATERIALIZE_ENABLED = process.env.NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN == "true"

const INITIAL_SCHEMA: PageSchema = {
  id: "draft-page",
  version: "1.0",
  title: { en: "Untitled page", ar: "صفحة جديدة" },
  permission: PERMISSIONS.ADMIN_PAGE_BUILDER,
  layout: "full",
  blocks: [],
}

export interface PageBuilderCanvasProps {
  initialSchema?: PageSchema
}

const DEFAULT_SWAGGER_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/swagger/v1/swagger.json`
  : ""

export function PageBuilderCanvas({ initialSchema = INITIAL_SCHEMA }: PageBuilderCanvasProps) {
  const state = useCanvasState(initialSchema)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isSwaggerWizardOpen, setIsSwaggerWizardOpen] = useState(false)
  // Bumped after every palette-driven add — `LayersPalettePanel` watches
  // the counter and flips itself to the Layers tab so the new block is
  // immediately visible. The counter (rather than a boolean) avoids
  // flapping when the same value would be rewritten on consecutive adds.
  const [switchToLayersSignal, setSwitchToLayersSignal] = useState(0)
  const notify = useNotification()
  const router = useRouter()
  const persist = useSavePage()
  const materialize = useMaterializePage()

  const handleSave = useCallback(
    () => persist.trigger({ schema: state.schema, notify, onSaved: state.save }),
    [persist, state.schema, state.save, notify],
  )
  const handleMaterialize = useCallback(
    () => materialize.trigger({ pageId: state.schema.id, isDirty: state.isDirty, notify }),
    [materialize, state.schema.id, state.isDirty, notify],
  )

  const handleAddType = useCallback(
    (type: string) => {
      const block = instantiateBlock(type)
      if (!block) return
      // Palette inserts to the root only — nested adds land
      // through the per-container "+ Add child" affordance in BlockTree.
      state.insertBlock(null, { kind: "root", index: 0 }, state.schema.blocks.length, block)
      setSwitchToLayersSignal(s => s + 1)
    },
    [state],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const type = event.dataTransfer.getData(PAGE_BUILDER_DRAG_TYPE)
      if (type) handleAddType(type)
    },
    [handleAddType],
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }, [])

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col" data-testid="page-builder-canvas">
        <CanvasHeader
          state={state}
          isPreviewMode={isPreviewMode}
          isSaving={persist.isSaving}
          isMaterializing={materialize.isMaterializing}
          onBack={() => router.push("/admin/page-builder")}
          onTogglePreview={() => setIsPreviewMode(p => !p)}
          onOpenSwagger={() => setIsSwaggerWizardOpen(true)}
          onSave={handleSave}
          onMaterialize={handleMaterialize}
        />
        {materialize.lastResult && (
          <MaterializeResultBanner result={materialize.lastResult} onDismiss={materialize.dismissResult} />
        )}
        {isPreviewMode ? (
          <main className="flex-1 overflow-y-auto p-6" data-testid="canvas-preview-mode">
            <PreviewPane schema={state.schema} onUpdateBlock={state.updateBlockById} />
          </main>
        ) : (
          <CanvasEditBody
            state={state}
            onAddType={handleAddType}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            switchToLayersSignal={switchToLayersSignal}
          />
        )}
        <SwaggerWizard
          open={isSwaggerWizardOpen}
          onClose={() => setIsSwaggerWizardOpen(false)}
          onAccept={schema => {
            state.replaceSchema(schema)
            setIsSwaggerWizardOpen(false)
          }}
          defaultUrl={DEFAULT_SWAGGER_URL}
        />
      </div>
    </TooltipProvider>
  )
}

interface CanvasHeaderProps {
  state: ReturnType<typeof useCanvasState>
  isPreviewMode: boolean
  isSaving: boolean
  isMaterializing: boolean
  onBack: () => void
  onTogglePreview: () => void
  onOpenSwagger: () => void
  onSave: () => void
  onMaterialize: () => void
}

function CanvasHeader({
  state,
  isPreviewMode,
  isSaving,
  isMaterializing,
  onBack,
  onTogglePreview,
  onOpenSwagger,
  onSave,
  onMaterialize,
}: CanvasHeaderProps) {
  const materializeDisabled = !MATERIALIZE_ENABLED || state.isDirty || isMaterializing
  const materializeTooltip = !MATERIALIZE_ENABLED
    ? "Set NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN=true to enable"
    : state.isDirty
      ? "Save the page first"
      : isMaterializing
        ? "Materializing…"
        : "Promote this page to source files (commits to src/app/(dashboard)/pages)"
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} title="Back to pages" data-testid="btn-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{state.schema.title.en || "Untitled page"}</h1>
          <p className="truncate font-mono text-[10px] text-muted-foreground">/pages/{state.schema.id}</p>
        </div>
        {state.isDirty && (
          <span
            className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
            data-testid="dirty-indicator"
          >
            Unsaved
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onOpenSwagger} data-testid="btn-swagger">
          <FileCode2 className="me-1 h-4 w-4" />
          Create from API
        </Button>
        <Button size="sm" variant="ghost" onClick={state.undo} disabled={!state.canUndo} data-testid="btn-undo">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={state.redo} disabled={!state.canRedo} data-testid="btn-redo">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onTogglePreview} data-testid="btn-preview">
          <Eye className="me-1 h-4 w-4" />
          {isPreviewMode ? "Edit" : "Preview"}
        </Button>
        <Button size="sm" variant="outline" onClick={state.discard} disabled={!state.isDirty} data-testid="btn-discard">
          <Trash2 className="me-1 h-4 w-4" />
          Discard
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={onSave}
          disabled={!state.isDirty || isSaving}
          data-testid="btn-save"
        >
          <Save className="me-1 h-4 w-4" />
          Save
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button
                size="sm"
                variant="outline"
                onClick={onMaterialize}
                disabled={materializeDisabled}
                data-testid="btn-materialize"
              >
                <Wrench className="me-1 h-4 w-4" />
                Materialize
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{materializeTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

interface CanvasEditBodyProps {
  state: ReturnType<typeof useCanvasState>
  onAddType: (type: string) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  switchToLayersSignal: number
}

function CanvasEditBody({ state, onAddType, onDrop, onDragOver, switchToLayersSignal }: CanvasEditBodyProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-80 shrink-0 overflow-y-auto border-e border-border bg-muted/20 p-4">
        <LayersPalettePanel state={state} onAddType={onAddType} switchToLayersSignal={switchToLayersSignal} />
      </aside>
      <main
        className="flex-1 overflow-y-auto p-4"
        onDrop={onDrop}
        onDragOver={onDragOver}
        data-testid="canvas-drop-zone"
      >
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live preview</h2>
        <PreviewPane schema={state.schema} onUpdateBlock={state.updateBlockById} />
      </main>
      <aside className="w-96 shrink-0 overflow-y-auto border-s border-border bg-muted/20 p-4">
        <PropertiesPanel
          block={state.selectedBlock}
          onChange={state.updateBlockById}
          onRemove={state.removeBlockById}
        />
      </aside>
    </div>
  )
}

interface MaterializeResultBannerProps {
  result: MaterializeResult
  onDismiss: () => void
}

function MaterializeResultBanner({ result, onDismiss }: MaterializeResultBannerProps) {
  return (
    <div
      className="border-b border-success/30 bg-success/10 px-4 py-2 text-sm text-success"
      data-testid="materialize-result-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold">Materialized — {result.filesWritten.length} file(s) written</p>
          <ul className="font-mono text-xs">
            {result.filesWritten.map(p => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <p className="mt-1 text-xs text-warning">
              {result.warnings.length} warning(s) — see browser console for detail
            </p>
          )}
          {result.backupId && (
            <p className="text-xs text-muted-foreground">
              Backup: <code>.entity-builder-backups/{result.backupId}/</code>
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss} data-testid="materialize-banner-dismiss">
          Dismiss
        </Button>
      </div>
    </div>
  )
}
