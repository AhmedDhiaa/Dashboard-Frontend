"use client"

/**
 * Properties panel for the currently selected block.
 *
 * Two tabs:
 *
 *   - **Form** (default) — feeds `block.propsSchema` directly into the
 *     same `SchemaFormRenderer` end-users see. Editing is dispatched
 *     through RHF; Apply runs the resolver (zod) and bubbles validated
 *     props to the canvas. The "circular reuse" goal of spec §4 — the
 *     block author and the page user share one form renderer.
 *
 *   - **Advanced (JSON)** — the original JSON editor. Stays as an
 *     escape hatch for complex shapes (arrays of blocks, custom-block
 *     props bag) that the form renderer can't yet describe.
 *
 * Both tabs share the same `onChange(id, next)` contract; the canvas
 * doesn't need to know which path validated.
 */

import { useEffect, useMemo, useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/design-system/primitives/tabs"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { Button } from "@/ui/design-system/primitives/button"
import { SchemaFormRenderer } from "@/core/crud/components/SchemaFormRenderer"
import type { FormFieldConfig } from "@/core/entities/types"
import { blockRegistry, type BlockDefinition } from "../registry/block-registry"
import type { BlockSchema } from "../schema/block-schema"

interface BlockNode {
  id: string
  type: string
}

// `id` + `type` are the discriminator fields; editing them would orphan
// the block. The form-side hides them but the underlying schema still
// validates them — we just keep the originals on submit.
const EXCLUDED_META_FIELDS = ["id", "type"]

export interface PropertiesPanelProps {
  block: BlockSchema | null
  onChange: (id: string, next: BlockSchema) => void
  onRemove?: (id: string) => void
}

export function PropertiesPanel({ block, onChange, onRemove }: PropertiesPanelProps) {
  const node = block as unknown as BlockNode | null
  const def = useMemo(() => (node ? blockRegistry.get(node.type) : undefined), [node])

  if (!block || !node) {
    return (
      <div className="space-y-2" data-testid="properties-panel-empty">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Properties</h2>
        <p className="text-sm text-muted-foreground">Select a block to edit its properties.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="properties-panel">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Properties</h2>
        <span className="text-xs font-mono text-muted-foreground">{node.type}</span>
      </header>
      {def && <p className="text-xs text-muted-foreground">{def.description.en}</p>}

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form" data-testid="properties-tab-form">
            Form
          </TabsTrigger>
          <TabsTrigger value="json" data-testid="properties-tab-json">
            Advanced (JSON)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="pt-3">
          {def ? (
            <FormProperties key={node.id} block={block} node={node} def={def} onChange={onChange} />
          ) : (
            <p className="text-sm text-muted-foreground">No registered block for type {`"${node.type}"`}.</p>
          )}
        </TabsContent>
        <TabsContent value="json" className="pt-3">
          <JsonProperties block={block} node={node} def={def} onChange={onChange} />
        </TabsContent>
      </Tabs>

      {onRemove && (
        <Button onClick={() => onRemove(node.id)} variant="destructive" size="sm" data-testid="properties-remove">
          Delete block
        </Button>
      )}
    </div>
  )
}

// ─── Form tab — SchemaFormRenderer-driven ──────────────────────────────────

interface FormPropertiesInnerProps {
  block: BlockSchema
  node: BlockNode
  def: BlockDefinition<unknown>
  onChange: (id: string, next: BlockSchema) => void
}

function FormProperties({ block, node, def, onChange }: FormPropertiesInnerProps) {
  const methods = useForm<Record<string, unknown>>({
    defaultValues: block as Record<string, unknown>,
    // zodResolver type doesn't unify with the dynamic propsSchema —
    // same cast pattern as form-block.tsx and CRUDEditPage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(def.propsSchema as any),
  })

  const errors = methods.formState.errors

  const handleApply = methods.handleSubmit(values => {
    // Preserve the original `id` + `type` so the form can't orphan the block.
    const next = { ...values, id: node.id, type: node.type } as BlockSchema
    onChange(node.id, next)
  })

  return (
    <FormProvider {...methods}>
      <div className="space-y-3" data-testid="properties-form">
        <SchemaFormRenderer
          schema={def.propsSchema as z.ZodObject<z.ZodRawShape>}
          fieldConfig={emptyFieldConfig}
          excludeFields={EXCLUDED_META_FIELDS}
        />
        {Object.keys(errors).length > 0 && (
          <pre
            className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap"
            data-testid="properties-form-error"
          >
            {summariseErrors(errors)}
          </pre>
        )}
        <Button onClick={handleApply} variant="default" size="sm" data-testid="properties-apply">
          Apply
        </Button>
      </div>
    </FormProvider>
  )
}

// SchemaFormRenderer requires a fieldConfig record; we pass an empty one
// so the renderer falls back to its own type inference. (Per-field tweaks
// — e.g. `description` → textarea — already live inside getFieldType.)
const emptyFieldConfig: Record<string, FormFieldConfig> = {}

function summariseErrors(errors: Record<string, unknown>): string {
  const lines: string[] = []
  const walk = (node: unknown, prefix: string): void => {
    if (!node || typeof node !== "object") return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "ref") continue
      if (key === "message" && typeof value === "string") {
        lines.push(`${prefix || "(root)"}: ${value}`)
        continue
      }
      walk(value, prefix ? `${prefix}.${key}` : key)
    }
  }
  walk(errors, "")
  return lines.length > 0 ? lines.join("\n") : "Validation failed"
}

// ─── JSON tab — escape hatch for complex shapes ───────────────────────────

interface JsonPropertiesProps {
  block: BlockSchema
  node: BlockNode
  def: BlockDefinition<unknown> | undefined
  onChange: (id: string, next: BlockSchema) => void
}

function JsonProperties({ block, node, def, onChange }: JsonPropertiesProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(block, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  // Re-hydrate when the selected block changes.
  useEffect(() => {
    setDraft(JSON.stringify(block, null, 2))
    setParseError(null)
  }, [block])

  const handleApply = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON")
      return
    }
    if (!def) {
      setParseError(`No registered block for type "${node.type}"`)
      return
    }
    const result = def.propsSchema.safeParse(parsed)
    if (!result.success) {
      setParseError(result.error.issues.map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"))
      return
    }
    setParseError(null)
    onChange(node.id, parsed as BlockSchema)
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={20}
        className="font-mono text-xs"
        data-testid="properties-json-editor"
      />
      {parseError && (
        <pre
          className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap"
          data-testid="properties-json-error"
        >
          {parseError}
        </pre>
      )}
      <Button onClick={handleApply} variant="default" size="sm" data-testid="properties-apply-json">
        Apply
      </Button>
    </div>
  )
}
