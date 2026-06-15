"use client"

/**
 * EntityDataView — the runtime CRUD page for one entity. Combines:
 *   - DynamicTable (list + search + delete)
 *   - DynamicForm in a Dialog (create + edit)
 *
 * This is what every entity-bound runtime page renders.
 */

import { useState } from "react"
import type { RuntimeEntity, RuntimeRecord } from "../types"
import { useRuntimeProvider } from "../store"
import { DynamicTable } from "./DynamicTable"
import { DynamicForm } from "./DynamicForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/design-system/primitives/dialog"

export function EntityDataView({ entity }: { entity: RuntimeEntity }) {
  const provider = useRuntimeProvider()
  const [editing, setEditing] = useState<RuntimeRecord | null>(null)
  const [creating, setCreating] = useState(false)

  const dialogOpen = creating || editing !== null
  const closeDialog = () => {
    setCreating(false)
    setEditing(null)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing) {
      provider.update(entity.id, editing.id, values)
    } else {
      provider.create(entity.id, values)
    }
    closeDialog()
  }

  return (
    <>
      <DynamicTable
        entity={entity}
        onCreate={() => {
          setEditing(null)
          setCreating(true)
        }}
        onEdit={record => {
          setCreating(false)
          setEditing(record)
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${entity.singularName}` : `New ${entity.singularName}`}</DialogTitle>
          </DialogHeader>
          <DynamicForm
            fields={entity.fields}
            initialValues={editing ?? undefined}
            submitLabel={editing ? "Save changes" : "Create"}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
