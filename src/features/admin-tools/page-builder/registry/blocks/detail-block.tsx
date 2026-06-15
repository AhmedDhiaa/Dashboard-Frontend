"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { detailBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"
import { useBlockData } from "../../renderer/useBlockData"

type DetailBlockProps = z.infer<typeof detailBlock>

/**
 * Detail-block renderer — fetches a single entity / record via
 * `useBlockData`, then renders each declared section as a Card whose body
 * is a `<dl>` of `field` ⇒ `value` pairs. The sections shape is read from
 * the schema; data is sourced server-side via the configured
 * `dataSource`. URL `entityId` is plumbed through `useBlockData.options.params`
 * so an entity dataSource resolves to `service.getById(entityId)`; api +
 * swagger sources flow through their own resolved endpoints.
 *
 * The entity id is read from the `data-entity-id` attribute on a
 * closest ancestor (set by the dynamic /pages/[pageId] route, where
 * the URL surfaces it).
 *
 * TODO: consider swapping this DOM-attribute plumbing for a React
 * Context once a second consumer needs the entity id.
 */
const DetailBlockRender: ComponentType<DetailBlockProps> = ({ sections, dataSource, hidden }) => {
  const entityId = useEntityIdFromDom()
  const { data, loading, error } = useBlockData<Record<string, unknown>>(dataSource, {
    params: entityId !== undefined ? { entityId } : undefined,
  })
  if (hidden) return null
  return (
    <div className="space-y-4">
      {sections.map(section => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title.en}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-full" />
            ) : error ? (
              <p className="text-sm text-destructive">{error.message}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                {section.fields.map(field => (
                  <div key={field.field}>
                    <dt className="text-xs text-muted-foreground">{field.label?.en ?? field.field}</dt>
                    <dd className="text-sm">{formatCell(readDotPath(data, field.field))}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function readDotPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") return undefined
  const segments = path.split(".")
  let cursor: unknown = source
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== "object") return undefined
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "boolean") return value ? "✓" : "✗"
  return String(value)
}

/**
 * Lightweight cross-cutting probe — finds the nearest `data-entity-id`
 * attribute that the dynamic route emits. Falls back to `undefined` so
 * the data hook makes a `getList()` call instead. We avoid `usePathname`
 * / `useParams` here so the block stays usable inside the canvas
 * preview where there is no `[pageId]` route segment yet.
 */
function useEntityIdFromDom(): string | undefined {
  if (typeof document === "undefined") return undefined
  const node = document.querySelector("[data-entity-id]")
  return node?.getAttribute("data-entity-id") ?? undefined
}

export const detailBlockDefinition: BlockDefinition<DetailBlockProps> = {
  type: "detail",
  category: "data",
  displayName: { en: "Detail", ar: "تفاصيل" },
  icon: "FileText",
  description: { en: "Read-only entity detail card with sections.", ar: "بطاقة تفاصيل قراءة-فقط." },
  propsSchema: detailBlock,
  defaultProps: detailBlock.parse({
    id: "detail-1",
    type: "detail",
    dataSource: { type: "entity", entityName: "order" },
    sections: [
      {
        id: "main",
        title: { en: "Main", ar: "الرئيسية" },
        fields: [{ field: "id" }],
      },
    ],
  }),
  Render: DetailBlockRender,
  wraps: {
    componentPath: "src/core/crud/components/BaseDetailRenderer.tsx",
    componentName: "Card per section (data via useBlockData)",
  },
}
