/**
 * Shared test fixtures for the tree-utils suite.
 *
 * BlockSchema is typed as `unknown` (z.ZodType annotation), so we shape
 * literal blocks with structural objects and cast at the boundary. Every
 * helper returns a fresh deep clone — tests can mutate freely.
 */

import type { PageSchema } from "../../../schema/page-schema"
import type { BlockSchema } from "../../../schema/block-schema"

const localized = (en: string, ar: string) => ({ en, ar })

const asBlock = <T>(b: T): BlockSchema => b as unknown as BlockSchema

export function heading(id: string, text = "Heading"): BlockSchema {
  return asBlock({
    id,
    type: "heading",
    text: localized(text, text),
    level: 2,
    hidden: false,
  })
}

export function kpi(id: string): BlockSchema {
  return asBlock({
    id,
    type: "kpi",
    dataSource: { type: "entity", entityName: "order" },
    valueField: "totalCount",
    label: localized("KPI", "ك"),
    hidden: false,
  })
}

export function card(id: string, blocks: BlockSchema[] = []): BlockSchema {
  return asBlock({
    id,
    type: "card",
    blocks,
    hidden: false,
  })
}

export function grid(id: string, blocks: BlockSchema[] = []): BlockSchema {
  return asBlock({
    id,
    type: "grid",
    columns: 2,
    blocks,
    hidden: false,
  })
}

export interface TabSpec {
  id: string
  label?: string
  blocks: BlockSchema[]
}

export function tabs(id: string, tabSpecs: TabSpec[]): BlockSchema {
  return asBlock({
    id,
    type: "tabs",
    tabs: tabSpecs.map(t => ({
      id: t.id,
      label: localized(t.label ?? t.id, t.label ?? t.id),
      blocks: t.blocks,
    })),
    hidden: false,
  })
}

export interface ItemSpec {
  id: string
  title?: string
  blocks: BlockSchema[]
}

export function accordion(id: string, itemSpecs: ItemSpec[]): BlockSchema {
  return asBlock({
    id,
    type: "accordion",
    multiple: false,
    items: itemSpecs.map(it => ({
      id: it.id,
      title: localized(it.title ?? it.id, it.title ?? it.id),
      blocks: it.blocks,
    })),
    hidden: false,
  })
}

export function form(id: string): BlockSchema {
  return asBlock({
    id,
    type: "form",
    fields: [],
    layout: { type: "grid", rows: [] },
    submitAction: { type: "api", method: "POST", endpoint: "/x" },
    hidden: false,
  })
}

export function pageWith(blocks: BlockSchema[]): PageSchema {
  return {
    id: "test-page",
    version: "1.0",
    title: localized("Test", "اختبار"),
    permission: "Api.Admin.PageBuilder",
    layout: "full",
    blocks,
  } as never
}
