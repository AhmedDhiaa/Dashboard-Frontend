"use client"

/**
 * EntityFieldsList — the "Fields" Card inside the entity builder.
 *
 * Renders the `RuntimeField[]` as a list of `EntityFieldEditor` cards plus
 * the "Add field" button. All mutation handlers are passed in by the
 * parent so this file stays a pure presentational shell.
 */

import { Plus } from "lucide-react"
import type { RuntimeField } from "../types"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { EntityFieldEditor } from "./EntityFieldEditor"

export interface EntityFieldsListProps {
  fields: RuntimeField[]
  onAdd: () => void
  onUpdate: (idx: number, patch: Partial<RuntimeField>) => void
  onRemove: (idx: number) => void
  onMove: (idx: number, dir: -1 | 1) => void
  onMakeTitle: (idx: number) => void
}

export function EntityFieldsList({ fields, onAdd, onUpdate, onRemove, onMove, onMakeTitle }: EntityFieldsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Fields</CardTitle>
        <Button onClick={onAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add field
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f, idx) => (
          <EntityFieldEditor
            key={idx}
            index={idx}
            field={f}
            isFirst={idx === 0}
            isLast={idx === fields.length - 1}
            canRemove={fields.length > 1}
            onChange={patch => onUpdate(idx, patch)}
            onMove={dir => onMove(idx, dir)}
            onRemove={() => onRemove(idx)}
            onMakeTitle={() => onMakeTitle(idx)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
