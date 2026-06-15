"use client"

/**
 * EntityList — the home for the entities tab in the builder. Shows every
 * defined runtime entity, lets the user open the editor, delete, or create
 * a new one. Edits and deletes flow through provider actions so the rest
 * of the app refreshes immediately.
 */

import { useState } from "react"
import { Database, Pencil, Plus, Rocket, Trash2 } from "lucide-react"
import type { RuntimeEntity } from "../types"
import { deleteEntity, useRuntimeConfig, useRuntimeProvider } from "../store"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { ConfirmDialog } from "@/ui/design-system/primitives/ConfirmDialog"
import { EntityBuilder } from "./EntityBuilder"
import { MaterializeDialog } from "./MaterializeDialog"

// eslint-disable-next-line max-lines-per-function -- Single entities-tab surface
export function EntityList() {
  const provider = useRuntimeProvider()
  const config = useRuntimeConfig()
  const [editing, setEditing] = useState<RuntimeEntity | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<RuntimeEntity | null>(null)
  const [materializing, setMaterializing] = useState<RuntimeEntity | null>(null)

  if (creating || editing) {
    return (
      <EntityBuilder
        initialEntity={editing ?? undefined}
        onSaved={() => {
          setCreating(false)
          setEditing(null)
        }}
        onCancel={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{config.entities.length} entity(ies) defined</h3>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New entity
        </Button>
      </div>

      {config.entities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-2">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No entities yet. Create one to start building your dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {config.entities.map(e => (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{e.pluralName}</CardTitle>
                    <CardDescription className="font-mono text-xs">{e.id}</CardDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMaterializing(e)}
                      aria-label="Materialize to source files"
                      title="Materialize to source files"
                    >
                      <Rocket className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(e)} aria-label="Edit entity">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPendingDelete(e)} aria-label="Delete entity">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {e.description && <p className="text-sm text-muted-foreground mb-2">{e.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {e.fields.slice(0, 6).map(f => (
                    <span key={f.key} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {f.label}
                    </span>
                  ))}
                  {e.fields.length > 6 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{e.fields.length - 6}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && setPendingDelete(null)}
        title={`Delete entity "${pendingDelete?.pluralName}"?`}
        description="All records and pages bound to this entity will be permanently removed."
        confirmText="Delete entity"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteEntity(provider, pendingDelete.id)
          setPendingDelete(null)
        }}
      />

      {materializing && (
        <MaterializeDialog
          entity={materializing}
          open={materializing !== null}
          onOpenChange={open => !open && setMaterializing(null)}
        />
      )}
    </>
  )
}
