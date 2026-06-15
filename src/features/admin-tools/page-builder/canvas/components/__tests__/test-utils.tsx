import { vi } from "vitest"
import type { PageSchema } from "../../../schema/page-schema"
import type { BlockSchema } from "../../../schema/block-schema"
import type { useCanvasState } from "../../hooks/useCanvasState"

const localized = (en: string, ar: string) => ({ en, ar })
const asBlock = <T,>(b: T) => b as unknown as BlockSchema

export const heading = (id: string, text = "Heading"): BlockSchema =>
  asBlock({ id, type: "heading", text: localized(text, text), level: 2, hidden: false })

export const card = (id: string, blocks: BlockSchema[] = []): BlockSchema =>
  asBlock({ id, type: "card", blocks, hidden: false })

export const tabs = (id: string, tabSpecs: { id: string; label?: string; blocks: BlockSchema[] }[]): BlockSchema =>
  asBlock({
    id,
    type: "tabs",
    hidden: false,
    tabs: tabSpecs.map(t => ({
      id: t.id,
      label: localized(t.label ?? t.id, t.label ?? t.id),
      blocks: t.blocks,
    })),
  })

export const baseSchema = (blocks: BlockSchema[]): PageSchema =>
  ({
    id: "test-page",
    version: "1.0",
    title: localized("Test", "اختبار"),
    permission: "Api.Admin.PageBuilder",
    layout: "full",
    blocks,
  }) as never

export type CanvasStateMock = ReturnType<typeof useCanvasState>

/**
 * Build a state object shaped like `useCanvasState`'s return. Mutations
 * are vi.fn() so tests can assert call shapes; read-only fields can be
 * overridden via the optional `overrides` arg.
 */
export function makeMockState(schema: PageSchema, overrides: Partial<CanvasStateMock> = {}): CanvasStateMock {
  return {
    schema,
    selectedId: null,
    selectedPath: null,
    selectedBlock: null,
    isDirty: false,
    canUndo: false,
    canRedo: false,
    selectBlock: vi.fn(),
    insertBlock: vi.fn(),
    removeBlockAt: vi.fn(),
    updateBlockAt: vi.fn(),
    moveBlock: vi.fn(),
    duplicateBlockAt: vi.fn(),
    removeBlockById: vi.fn(),
    updateBlockById: vi.fn(),
    duplicateBlockById: vi.fn(),
    replaceSchema: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    ...overrides,
  }
}
