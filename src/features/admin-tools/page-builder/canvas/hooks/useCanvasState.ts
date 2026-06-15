"use client"

/**
 * Canvas state machine for the Page Builder — path-based addressing.
 *
 * Holds:
 *   - the current page schema (single source of truth for the editor)
 *   - undo/redo history (last 20 mutations) — past + present + future
 *   - the saved snapshot — drives the `isDirty` flag and the future "Save" diff
 *   - the currently selected block id
 *
 * Selection is id-based externally (stable across moves) and path-based
 * internally (computed from `findBlockById` on every render). After
 * `moveBlock` the id stays put and the path is recomputed by the next
 * render. After `removeBlockAt` of the selected block the selection is
 * cleared. After `replaceSchema` the selection is cleared because ids
 * may not survive a bulk replacement (e.g. Swagger wizard rebuild).
 *
 * Selection is OUTSIDE history — undo/redo doesn't restore the prior
 * selection. This matches the convention in most visual editors and
 * keeps the history layer focussed on what's persistable.
 *
 * Mutations route through `commit(next)` so every change is undoable
 * and the dirty flag updates synchronously. `replaceSchema` also goes
 * through commit, so undoing a Swagger import is a single-step undo.
 *
 * `beforeunload` is wired here so closing/reloading the tab while dirty
 * surfaces a "you may lose changes" prompt; the listener auto-cleans up.
 *
 * Layered hooks below (`useHistoryReducer`, `useCanvasMutations`) keep
 * the public `useCanvasState` body small enough to fit the per-function
 * line cap without sacrificing the single-entry public API.
 */

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useNotification } from "@/ui/application/hooks/useNotification"
import type { PageSchema } from "../../schema/page-schema"
import type { BlockSchema } from "../../schema/block-schema"
import {
  asBlockNode,
  canDropInto,
  duplicateBlockAt as duplicateBlockAtTree,
  findBlockById,
  getBlockAt,
  getContainerSlots,
  insertBlockAt,
  moveBlock as moveBlockTree,
  removeBlockAt as removeBlockAtTree,
  setBlockAt,
  type BlockPath,
  type DropValidation,
  type PathSegment,
} from "../tree"

const HISTORY_LIMIT = 20

type Notifier = ReturnType<typeof useNotification>

interface History {
  past: PageSchema[]
  present: PageSchema
  future: PageSchema[]
}

export interface CanvasState {
  // ─── Read-only state ─────────────────────────────────────────────────────
  schema: PageSchema
  selectedId: string | null
  selectedPath: BlockPath | null
  selectedBlock: BlockSchema | null
  isDirty: boolean
  canUndo: boolean
  canRedo: boolean

  // ─── Selection (id-based for external callers) ───────────────────────────
  selectBlock: (id: string | null) => void

  // ─── Path-based mutations ────────────────────────────────────────────────
  insertBlock: (parentPath: BlockPath | null, slot: PathSegment, index: number, block: BlockSchema) => void
  removeBlockAt: (path: BlockPath) => void
  updateBlockAt: (path: BlockPath, next: BlockSchema) => void
  moveBlock: (fromPath: BlockPath, toParentPath: BlockPath | null, toSlot: PathSegment, toIndex: number) => void
  /** Returns the new id, or null if the source path was invalid. */
  duplicateBlockAt: (path: BlockPath) => string | null

  // ─── ID-based wrappers (look up the path then delegate) ──────────────────
  removeBlockById: (id: string) => void
  updateBlockById: (id: string, next: BlockSchema) => void
  duplicateBlockById: (id: string) => string | null

  // ─── Bulk ────────────────────────────────────────────────────────────────
  replaceSchema: (next: PageSchema) => void

  // ─── History ─────────────────────────────────────────────────────────────
  undo: () => void
  redo: () => void

  // ─── Persistence ─────────────────────────────────────────────────────────
  save: () => void
  discard: () => void
}

export function useCanvasState(initial: PageSchema): CanvasState {
  const reducer = useHistoryReducer(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const notify = useNotification()
  const { schema, commit } = reducer

  // Selection — id is the source of truth; path/block are derived.
  const selectionLookup = useMemo(() => (selectedId ? findBlockById(schema, selectedId) : null), [schema, selectedId])

  const mutations = useCanvasMutations({ schema, commit, selectedId, setSelectedId, notify })

  // Selection-resetting wrappers around the bulk + persistence ops.
  const replaceSchema = useCallback(
    (next: PageSchema) => {
      commit(next)
      setSelectedId(null)
    },
    [commit],
  )
  const discard = useCallback(() => {
    reducer.discard()
    setSelectedId(null)
  }, [reducer])
  const selectBlock = useCallback((id: string | null) => setSelectedId(id), [])

  // beforeunload guard — only mounted while dirty.
  useEffect(() => {
    if (!reducer.isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [reducer.isDirty])

  return {
    schema,
    selectedId,
    selectedPath: selectionLookup?.path ?? null,
    selectedBlock: selectionLookup?.block ?? null,
    isDirty: reducer.isDirty,
    canUndo: reducer.canUndo,
    canRedo: reducer.canRedo,
    selectBlock,
    ...mutations,
    replaceSchema,
    undo: reducer.undo,
    redo: reducer.redo,
    save: reducer.save,
    discard,
  }
}

// ─── History reducer ──────────────────────────────────────────────────────

interface HistoryReducer {
  schema: PageSchema
  commit: (next: PageSchema) => void
  undo: () => void
  redo: () => void
  save: () => void
  discard: () => void
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
}

function useHistoryReducer(initial: PageSchema): HistoryReducer {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const [savedSnapshot, setSavedSnapshot] = useState<PageSchema>(initial)

  const commit = useCallback((next: PageSchema) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    }))
  }, [])

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev
      const previous = prev.past[prev.past.length - 1]!
      return { past: prev.past.slice(0, -1), present: previous, future: [prev.present, ...prev.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev
      const next = prev.future[0]!
      return { past: [...prev.past, prev.present], present: next, future: prev.future.slice(1) }
    })
  }, [])

  const save = useCallback(() => {
    setSavedSnapshot(history.present)
  }, [history.present])

  const discard = useCallback(() => {
    setHistory({ past: [], present: savedSnapshot, future: [] })
  }, [savedSnapshot])

  return {
    schema: history.present,
    commit,
    undo,
    redo,
    save,
    discard,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    isDirty: history.present !== savedSnapshot,
  }
}

// ─── Path-based mutations + id-based wrappers ─────────────────────────────

interface MutationsDeps {
  schema: PageSchema
  commit: (next: PageSchema) => void
  selectedId: string | null
  setSelectedId: Dispatch<SetStateAction<string | null>>
  notify: Notifier
}

interface MutationsApi {
  insertBlock: CanvasState["insertBlock"]
  removeBlockAt: CanvasState["removeBlockAt"]
  updateBlockAt: CanvasState["updateBlockAt"]
  moveBlock: CanvasState["moveBlock"]
  duplicateBlockAt: CanvasState["duplicateBlockAt"]
  removeBlockById: CanvasState["removeBlockById"]
  updateBlockById: CanvasState["updateBlockById"]
  duplicateBlockById: CanvasState["duplicateBlockById"]
}

function useCanvasMutations(deps: MutationsDeps): MutationsApi {
  const { schema, commit, selectedId, setSelectedId, notify } = deps

  const insertBlock = useCallback<CanvasState["insertBlock"]>(
    (parentPath, slot, index, block) => {
      const validation = validateFreshInsert(schema, parentPath, slot)
      if (!validation.allowed) {
        notify.warning(validation.reason ?? "admin.pageBuilder.dropInvalid")
        return
      }
      commit(insertBlockAt(schema, parentPath, slot, index, block))
      setSelectedId(asBlockNode(block).id)
    },
    [schema, commit, setSelectedId, notify],
  )

  const removeBlockAt = useCallback<CanvasState["removeBlockAt"]>(
    path => {
      const target = getBlockAt(schema, path)
      if (!target) return
      commit(removeBlockAtTree(schema, path))
      if (asBlockNode(target).id === selectedId) setSelectedId(null)
    },
    [schema, commit, selectedId, setSelectedId],
  )

  const updateBlockAt = useCallback<CanvasState["updateBlockAt"]>(
    (path, nextBlock) => {
      const oldBlock = getBlockAt(schema, path)
      commit(setBlockAt(schema, path, nextBlock))
      // Transfer selection if the id was renamed by the update.
      if (!oldBlock) return
      const oldId = asBlockNode(oldBlock).id
      const newId = asBlockNode(nextBlock).id
      if (oldId === selectedId && oldId !== newId) setSelectedId(newId)
    },
    [schema, commit, selectedId, setSelectedId],
  )

  const moveBlock = useCallback<CanvasState["moveBlock"]>(
    (fromPath, toParentPath, toSlot, toIndex) => {
      const block = getBlockAt(schema, fromPath)
      if (!block) return
      const validation = canDropInto(schema, fromPath, toParentPath, toSlot)
      if (!validation.allowed) {
        notify.warning(validation.reason ?? "admin.pageBuilder.dropInvalid")
        return
      }
      commit(moveBlockTree(schema, fromPath, toParentPath, toSlot, toIndex))
      // selectedId stays — selectedPath is recomputed on the next render.
    },
    [schema, commit, notify],
  )

  const duplicateBlockAt = useCallback<CanvasState["duplicateBlockAt"]>(
    path => {
      const result = duplicateBlockAtTree(schema, path)
      if (!result.newId) return null
      commit(result.schema)
      setSelectedId(result.newId)
      return result.newId
    },
    [schema, commit, setSelectedId],
  )

  const removeBlockById = useCallback<CanvasState["removeBlockById"]>(
    id => {
      const lookup = findBlockById(schema, id)
      if (lookup) removeBlockAt(lookup.path)
    },
    [schema, removeBlockAt],
  )

  const updateBlockById = useCallback<CanvasState["updateBlockById"]>(
    (id, next) => {
      const lookup = findBlockById(schema, id)
      if (lookup) updateBlockAt(lookup.path, next)
    },
    [schema, updateBlockAt],
  )

  const duplicateBlockById = useCallback<CanvasState["duplicateBlockById"]>(
    id => {
      const lookup = findBlockById(schema, id)
      return lookup ? duplicateBlockAt(lookup.path) : null
    },
    [schema, duplicateBlockAt],
  )

  return {
    insertBlock,
    removeBlockAt,
    updateBlockAt,
    moveBlock,
    duplicateBlockAt,
    removeBlockById,
    updateBlockById,
    duplicateBlockById,
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Structural validation for a fresh-block insert. `canDropInto` from
 * tree/validation requires a real source path (it loads the dragged
 * block to check for cycles); for fresh inserts there is no source, so
 * we re-walk the structural rules here:
 *   - root inserts are always allowed
 *   - the parent must exist
 *   - form rejects all child blocks (it carries fields, not blocks)
 *   - the slot kind + tabId/itemId must match an existing slot on the parent
 */
function validateFreshInsert(schema: PageSchema, parentPath: BlockPath | null, slot: PathSegment): DropValidation {
  if (parentPath === null) return { allowed: true }
  const parent = getBlockAt(schema, parentPath)
  if (!parent) return { allowed: false, reason: "target-parent-not-found" }
  const parentNode = asBlockNode(parent)
  if (parentNode.type === "form") return { allowed: false, reason: "form-does-not-accept-blocks" }
  const slots = getContainerSlots(parent)
  const matched = slots.some(s => slotsMatch(s.segment, slot))
  if (!matched) return { allowed: false, reason: "slot-incompatible" }
  return { allowed: true }
}

function slotsMatch(a: PathSegment, b: PathSegment): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "tab" && b.kind === "tab") return a.tabId === b.tabId
  if (a.kind === "item" && b.kind === "item") return a.itemId === b.itemId
  return true
}
