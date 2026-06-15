"use client"

/**
 * /admin/theme — the unified Theme Studio.
 *
 * A full-bleed, app-like studio shell: a sticky top TOOLBAR (identity + status
 * chip + grouped actions) over a two-pane workspace. LEFT is the controls panel
 * — a refined tab rail (Templates · Colors · Typography · Shape & Size ·
 * Components · Effects · Mode) over a calm, scrollable section column. RIGHT is
 * a sticky, window-framed live PREVIEW with a Split/Current/After toggle.
 *
 * State lives in useCustomizerState; `useDraftPreview` mirrors the draft onto
 * the whole studio chrome while the preview samples pin explicit inline token
 * styles for a reliable compare. This file owns layout only — every control
 * still calls the same state setters it did before.
 */

import { useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Tabs, TabsContent } from "@/ui/design-system/primitives/tabs"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { useCustomizerState, type CustomizerState } from "./useCustomizerState"
import { useDraftPreview } from "./useDraftPreview"
import { StudioToolbar } from "./StudioToolbar"
import { TabNav, STUDIO_TABS } from "./TabNav"
import { PreviewFrame } from "./PreviewFrame"
import { ModeToggle } from "./ModeToggle"
import { ColorControls } from "./ColorControls"
import { FontPicker } from "./FontPicker"
import { TokenControls } from "./NumericControls"
import { PresetsPanel } from "./PresetsPanel"
import { CollapsibleSection } from "./CollapsibleSection"
import {
  COLOR_GROUPS,
  COLOR_TOKENS,
  COMPONENT_GROUPS,
  COMPONENT_TOKENS,
  EFFECT_TOKENS,
  LAYOUT_TOKENS,
  SHAPE_TOKENS,
  TYPOGRAPHY_TOKENS,
} from "./token-catalog"

const MANAGE_PERMISSION = PERMISSIONS.THEME_MANAGE

const TYPOGRAPHY_TEXT_TOKENS = TYPOGRAPHY_TOKENS.filter(t => t.key === "--font-size-base" || t.key === "--font-mono")

export function ThemeCustomizerPage(): React.ReactNode {
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const canEdit = isAdmin || isGranted(MANAGE_PERMISSION)
  const state = useCustomizerState(canEdit)
  useDraftPreview(state.draft)
  const [notice, setNotice] = useState<string | null>(null)

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  if (!canEdit) return <ForbiddenNotice />

  return (
    // Full-bleed: cancel the content-well padding so the sticky toolbar spans
    // edge-to-edge, and fill the well's flex height with our own column.
    <div className="-m-4 flex min-h-0 flex-1 flex-col md:-m-6 lg:-m-8">
      <Tabs defaultValue="templates" className="flex min-h-0 flex-1 flex-col">
        {/* All top chrome (accent · toolbar · status · section nav) lives in ONE
            solid, sticky block. Solid (not translucent) so scrolled content
            never bleeds through it, and grouped so the tabs stay pinned with
            the toolbar instead of scrolling away. */}
        <div className="sticky top-0 z-30 bg-background shadow-[0_1px_0_0_var(--border),0_8px_24px_-16px_rgba(0,0,0,0.25)]">
          <div className="h-0.5 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-80" />
          <StudioToolbar
            state={state}
            onImportError={msg => setNotice(`Import failed: ${msg}`)}
            onImported={count => setNotice(`Imported ${count} token${count === 1 ? "" : "s"} into the draft.`)}
          />
          <StatusLine state={state} notice={notice} />
          {/* Full-width section nav so the controls column keeps its full width. */}
          <div className="border-t border-border bg-card/30 px-4 py-2.5 sm:px-6">
            <TabNav />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(27rem,42%)_minmax(0,1fr)]">
          <ControlPanel state={state} />
          <PreviewPanel state={state} />
        </div>
      </Tabs>
    </div>
  )
}

function StatusLine({ state, notice }: { state: CustomizerState; notice: string | null }) {
  const message = notice ?? state.status
  if (!message) return null
  return (
    <p className="border-b border-border bg-primary/5 px-4 py-1.5 text-xs text-primary sm:px-6">{message}</p>
  )
}

/* --------------------------------------------------------------- Controls */

function ControlPanel({ state }: { state: CustomizerState }) {
  return (
    <section className="flex min-h-0 flex-col gap-6 overflow-y-auto border-border p-4 sm:p-6 xl:border-e">
      <div className="mx-auto w-full max-w-2xl xl:mx-0 xl:max-w-none">
        <TabPanels state={state} />
      </div>
      {/* Below xl the dedicated preview pane is hidden — stack a framed
          preview here so the result stays visible on narrow screens. */}
      <div className="mx-auto h-[32rem] w-full max-w-2xl xl:hidden">
        <PreviewFrame state={state} />
      </div>
    </section>
  )
}

function TabPanels({ state }: { state: CustomizerState }) {
  return (
    <>
      <Section value="templates" title="Theme templates" hint="One click applies a complete, coherent palette to your draft. Mix and match, then fine-tune in the other tabs.">
        <PresetsPanel onApply={state.applyPreset} draft={state.draft} />
      </Section>
      <Section value="colors" title="Colors" hint="Every surface, brand, status, sidebar and chart token — seeded from the live value.">
        <ColorsTab state={state} />
      </Section>
      <Section value="typography" title="Typography" hint="Choose a bilingual font and fine-tune the base size and monospace stack.">
        <TypographyTab state={state} />
      </Section>
      <Section value="shape" title="Shape & size" hint="Corner radius plus the layout rhythm — header, sidebar and footer sizing.">
        <ShapeTab state={state} />
      </Section>
      <Section value="components" title="Components" hint="Per-component radius, padding and sizing overrides.">
        <ComponentsTab state={state} />
      </Section>
      <Section value="effects" title="Effects" hint="Glass blur, shadow strength and animation speed across the whole app.">
        <TokenControls specs={EFFECT_TOKENS} draft={state.draft} live={state.live} onChange={state.setToken} onReset={state.resetToken} />
      </Section>
      <Section value="mode" title="Color scheme" hint="Preview your edits in light, dark, or the system setting.">
        <ModeTab />
      </Section>
    </>
  )
}

/** A tab pane wrapper with a consistent section heading + helper text. */
function Section({ value, title, hint, children }: { value: string; title: string; hint: string; children: React.ReactNode }) {
  const tab = STUDIO_TABS.find(t => t.value === value)
  const Icon = tab?.icon
  return (
    <TabsContent value={value} className="mt-0 space-y-4">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      {children}
    </TabsContent>
  )
}

/* ----------------------------------------------------------------- Tabs */

function ColorsTab({ state }: { state: CustomizerState }) {
  const { draft, live, setToken, resetToken } = state
  return (
    <div className="space-y-3">
      {COLOR_GROUPS.map((group, i) => (
        <CollapsibleSection
          key={group.id}
          title={group.label}
          hint={group.hint}
          summary={`${COLOR_TOKENS.filter(t => t.group === group.id).length}`}
          defaultOpen={i === 0}
        >
          <ColorControls group={group.id} draft={draft} live={live} onChange={setToken} onReset={resetToken} />
        </CollapsibleSection>
      ))}
    </div>
  )
}

function TypographyTab({ state }: { state: CustomizerState }) {
  const { draft, live, setToken, clearToken, resetToken } = state
  return (
    <div className="space-y-4">
      <SubPanel title="Font family" hint="Pick a bilingual font — the sample shows Latin and Arabic. Applies to the whole app.">
        <FontPicker draft={draft} onChange={setToken} onClear={clearToken} />
      </SubPanel>
      <SubPanel title="Typography tokens" hint="Fine-tune the base size and the monospace stack.">
        <TokenControls specs={TYPOGRAPHY_TEXT_TOKENS} draft={draft} live={live} onChange={setToken} onReset={resetToken} />
      </SubPanel>
    </div>
  )
}

function ShapeTab({ state }: { state: CustomizerState }) {
  const { draft, live, setToken, resetToken } = state
  return (
    <div className="space-y-4">
      <SubPanel title="Corner radius" hint="The base radius — sm/md/lg/xl/2xl variants derive from it automatically.">
        <TokenControls specs={SHAPE_TOKENS} draft={draft} live={live} onChange={setToken} onReset={resetToken} />
      </SubPanel>
      <SubPanel title="Spacing & layout" hint="Layout rhythm, header/sidebar/footer sizing and the global font scale.">
        <TokenControls specs={LAYOUT_TOKENS} draft={draft} live={live} onChange={setToken} onReset={resetToken} />
      </SubPanel>
    </div>
  )
}

function ComponentsTab({ state }: { state: CustomizerState }) {
  const { draft, live, setToken, resetToken } = state
  return (
    <div className="space-y-3">
      {COMPONENT_GROUPS.map((group, i) => {
        const specs = COMPONENT_TOKENS.filter(t => t.group === group.id)
        return (
          <CollapsibleSection key={group.id} title={group.label} summary={`${specs.length}`} defaultOpen={i === 0}>
            <TokenControls specs={specs} draft={draft} live={live} onChange={setToken} onReset={resetToken} />
          </CollapsibleSection>
        )
      })}
    </div>
  )
}

function ModeTab() {
  return (
    <SubPanel title="Color scheme" hint="Edits are saved to the light (:root) layer only. The toggle previews how those values render in dark mode — it does not edit dark-mode-specific values.">
      <ModeToggle />
    </SubPanel>
  )
}

/* --------------------------------------------------------------- Preview */

function PreviewPanel({ state }: { state: CustomizerState }) {
  return (
    <section className="hidden min-h-0 flex-col p-4 sm:p-6 xl:flex">
      <PreviewFrame state={state} />
    </section>
  )
}

/** A calm card grouping a labelled control set inside a tab section. */
function SubPanel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </div>
  )
}

function ForbiddenNotice() {
  return (
    <div className="p-12 text-center">
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
      <p className="font-semibold">You don&apos;t have permission to edit the theme.</p>
      <p className="mt-1 text-xs text-muted-foreground">Required: {MANAGE_PERMISSION}</p>
    </div>
  )
}
