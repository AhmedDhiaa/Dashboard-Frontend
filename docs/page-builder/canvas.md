# Page Builder — Canvas Authoring Layer

> **Audience:** engineers reviewing or modifying the Canvas / DnD layer.
> **Companion docs:** [`architecture.md`](./architecture.md) (big
> picture), [`schema.md`](./schema.md) (Zod contracts),
> [`extending.md`](./extending.md) (recipe for new blocks),
> [`user-guide.md`](./user-guide.md) (end-user view).

This document covers Phase 2A (tree-based authoring) + Phase 2B (drag-
and-drop). Everything under `src/features/admin-tools/page-builder/
canvas/` is in scope; the runtime renderer lives under `../renderer/`
and is documented in `architecture.md`.

---

## 1. Overview

The Canvas is the editor surface admins use at `/admin/page-builder`.
It produces a `PageSchema` value (see [`schema.md`](./schema.md)) by
direct manipulation — drag, drop, click, JSON edit — and hands that
schema to the same `<PageRenderer>` the runtime route uses. Authoring
and runtime are intentionally one render path: what the admin sees in
the live-preview pane is byte-identical to `/pages/[pageId]`.

Three layers compose the Canvas:

1. **State** (`canvas/hooks/useCanvasState.ts`) — path-based mutations
   + undo/redo history + selection.
2. **Tree** (`canvas/tree/`) — pure helpers that walk, validate, and
   mutate the schema. No React, no DOM.
3. **DnD + components** (`canvas/components/`, `canvas/dnd/`) — the
   visual tree, drag-and-drop wiring, and shared primitives.

---

## 2. Layout architecture

```
PageBuilderCanvas (top-level shell)
├── CanvasHeader (Save / Discard / Preview / Materialize buttons)
└── CanvasEditBody (3-column layout)
    ├── Left rail (w-80)   — <LayersPalettePanel>
    │   ├── <Tabs>
    │   │   ├── Layers tab → <BlockTreeDndProvider>
    │   │   │                  └── <BlockTree state={state}>
    │   │   │                      └── <BlockTreeItem>* (recursive)
    │   │   │                          └── <BlockTreeSlot>*
    │   │   │                              └── <BlockTreeItem>*
    │   │   │                  └── <DragOverlay>
    │   │   │                      └── <DragOverlayPreview>
    │   │   └── Palette tab → <BlockPalette>
    │   └── (Tabs use a smart default + auto-switch — §3.5)
    ├── Main (flex-1)      — "Live preview" header + <PreviewPane>
    └── Right rail (w-96)  — <PropertiesPanel>
```

Materialize / Save / Header live above the body. Preview is the full
main column; the tree no longer competes for space.

---

## 3. State machine — `useCanvasState`

`canvas/hooks/useCanvasState.ts` owns the schema, history, and
selection. Internal layering:

```
useCanvasState
├── useHistoryReducer       — past / present / future snapshots
└── useCanvasMutations      — insert / remove / update / move /
                              duplicate (path-based) + id wrappers
```

### 3.1 What it returns

```ts
{
  schema: PageSchema                 // single source of truth
  selectedId: string | null          // external handle
  selectedPath: BlockPath | null     // derived via findBlockById
  selectedBlock: BlockSchema | null  // derived
  isDirty: boolean
  canUndo / canRedo: boolean

  // Path-based mutations
  insertBlock(parentPath, slot, index, block)
  removeBlockAt(path)
  updateBlockAt(path, next)
  moveBlock(from, toParent, toSlot, toIndex)
  duplicateBlockAt(path): newId | null

  // ID-based wrappers (look up the path then delegate)
  removeBlockById(id)
  updateBlockById(id, next)
  duplicateBlockById(id): newId | null

  // Bulk + lifecycle
  replaceSchema(next)
  selectBlock(id | null)
  undo() / redo() / save() / discard()
}
```

### 3.2 Selection lifecycle

`selectedId` is the source of truth; `selectedPath` and `selectedBlock`
are recomputed via `findBlockById` on every render. After a `moveBlock`
the id stays put and the path is rederived by the next render — admins
don't lose their selection just because a block reordered. After a
`removeBlockAt` of the selected block the selection clears. After
`replaceSchema` the selection clears because ids may not survive a
bulk replacement (e.g. Swagger wizard rebuild).

### 3.3 Selection is OUTSIDE history

Undo/redo replays schema snapshots only. The current selection isn't
restored along with the prior schema. This matches what most visual
editors do — the selection is workflow state, not data.

### 3.4 Validation routes through `state.moveBlock`

`canDropInto` (in `tree/validation.ts`) is invoked inside `moveBlock`
itself, so cycle detection, form rejection, and slot/kind compatibility
fire whether the call originated from a drag, a Move-to submenu pick,
or a Move ↑↓ button. A rejected drop surfaces as a `notify.warning`
toast and leaves the schema untouched.

### 3.5 `expandedIds` lives in `BlockTree`, not `useCanvasState`

The per-container expand state is intentionally a separate `useState`
inside `BlockTree`. It survives mutations (you don't want every
unrelated edit to collapse what you've expanded) but a `useEffect`
prunes ids that no longer point at containers after a `replaceSchema`
or a container `removeBlockAt` — see §7.2 below.

---

## 4. Tree layer (`canvas/tree/`)

Pure functions over `PageSchema`. No React, no side effects. Owned by
TASK 2A.1; details live in code comments + `tree/__tests__/`.

### 4.1 `BlockPath` shape

A path is a list of segments. The first segment is always
`{ kind: "root", index }`; subsequent segments descend into one of
five slot kinds:

| segment kind | descends into |
| --- | --- |
| `root` | `schema.blocks[index]` (only valid as the first segment) |
| `blocks` | `card.blocks[index]` / `grid.blocks[index]` |
| `tab` | `tabs.tabs[find tabId].blocks[index]` |
| `item` | `accordion.items[find itemId].blocks[index]` |
| `action-blocks` | `button.button.action.blocks[index]` (dialog/drawer body) |

Example path for a block inside the first tab of a `tabs` block
inside a card at root:

```ts
[
  { kind: "root", index: 0 },
  { kind: "blocks", index: 2 },         // 3rd child of the root card
  { kind: "tab", tabId: "tab-login", index: 1 }, // 2nd block of "tab-login"
]
```

### 4.2 Public surface

Exported from `tree/index.ts`:

- `BlockPath` / `PathSegment` / `BlockNode` / `asBlockNode`
- `generateBlockId(blockType)` / `regenerateIdsRecursive(block)`
- `getContainerSlots(block)` — uniform `{ segment, blocks, slotLabel }[]`
- `isContainer(block)` / `getContainerKind(block)`
- `walkBlocks(schema, visitor)` — DFS with path + parent + depth,
  abortable via `visitor → false`
- `canDropInto(schema, dragged, parentPath, slot)` —
  `{ allowed, reason? }`
- `isDescendantOf(schema, ancestorId, descendantId)`
- `findBlockById(schema, id)` — `{ block, path, parent, parentSlot }`
- `getBlockAt(schema, path)`
- `setBlockAt(schema, path, next)` / `insertBlockAt` / `removeBlockAt`
- `moveBlock(schema, from, toParent, toSlot, toIndex)` — handles the
  same-array index-after-removal adjustment
- `duplicateBlockAt(schema, path)` — recursive id regeneration
- `getDropTargets(schema, draggedPath)` — every legal drop position
  with a human-readable label (powers the Move-to submenu)

All mutating ops return a fresh `PageSchema` via `structuredClone`.
The full-clone baseline was an explicit TASK 2A.1 trade-off; switching
to structural sharing is a follow-up only if benchmarks demand it.

### 4.3 Validation rules

`canDropInto` enforces, in order:

1. Root drops (`parentPath === null`) are always allowed.
2. The dragged block must exist; the target parent must exist.
3. Cycle: rejecting drops onto the block itself or any descendant.
4. `form` blocks reject all children (their schema carries `fields[]`,
   not `blocks[]`).
5. Slot-kind compatibility — `blocks` only fires on card/grid, `tab`
   only on tabs blocks (with a real `tabId`), `item` only on accordion
   blocks (with a real `itemId`), `action-blocks` only on button.

Per-block-type bans (e.g. "no table inside table") are explicitly out
of scope. They belong on a registry-side whitelist when the use case
shows up.

---

## 5. DnD layer (`canvas/dnd/` + components)

### 5.1 Context boundary

`<BlockTreeDndProvider>` is the only `<DndContext>` in the canvas
subtree. It's mounted inside the Layers tab specifically — palette
drag (HTML5 dataTransfer) stays separate, and there's no provider
overhead when the admin is on the Palette tab.

```tsx
<BlockTreeDndProvider
  activeBlock={activeBlock}              // for the overlay preview
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragCancel={handleDragCancel}
>
  <BlockTree state={state} />
</BlockTreeDndProvider>
```

Sensors: a single `MouseSensor` with a 5px activation distance. Touch
isn't supported (Phase 2B is desktop-only). `autoScroll` is enabled
so dragging near the rail's top/bottom auto-scrolls the
`overflow-y-auto` aside.

### 5.2 Sortable items

Every `BlockTreeItem` registers itself via `useSortable`:

```ts
const sortable = useSortable({
  id: block.id,
  data: { path },            // BlockPath payload
})
```

The `<li>` is the visual drag target (`setNodeRef`, `transform`
style, opacity 0.4 while `isDragging`). Pointer listeners go on the
`<DragHandle>` button only — the rest of the row keeps its click
semantics (select, Move ↑↓, actions menu) even past the 5px
activation threshold.

`SortableContext` wraps the root iteration in `BlockTree` and the
populated branch of every `BlockTreeSlot`. Each context's `items` is
the ids of its direct children, with `verticalListSortingStrategy`.

### 5.3 Droppable slots

Every `BlockTreeSlot` registers a `useDroppable` with:

```ts
{
  id: `slot-${encodePath([...parentPath, segment])}`,
  data: { type: "slot", parentPath, slot: segment },
}
```

dnd-kit's deepest-collision default means a drop over a sortable item
inside this slot resolves to the item, not the slot. The slot's
`isOver` only fires when the cursor is in the gap area of a populated
slot or anywhere inside an empty slot — exactly the UX the spec asks
for (item gets a drop-line; slot gets a tint).

### 5.4 Drag end handler — `useDragHandlers`

`canvas/dnd/useDragHandlers.ts` is the bridge between dnd-kit events
and `state.moveBlock`. It reads the path payload from `active.data`
and the destination from `over.data`, then dispatches:

- **Item over item** (`over.data = { path }`): `state.moveBlock(from,
  parent, slot, slot.index)` — drop at the over-item's position.
- **Item over slot droppable** (`over.data = { type: "slot",
  parentPath, slot }`): `state.moveBlock(from, parentPath, slot, 0)`
  — append to the start of the empty slot.
- **No `over` / self-drop / missing path**: no-op (debug log for the
  missing-path case to surface wiring bugs).

The hook also tracks `activeId` / `activeBlock` for the overlay (§6.1)
across `onDragStart` / `onDragCancel` / `onDragEnd`.

### 5.5 Path encoding (`canvas/dnd/path-encoding.ts`)

Round-trip `BlockPath ↔ string` via a pipe/colon-separated format:
`root:0|blocks:1|tab:tab-login:2`. Used today for the slot
droppable id; designed to support persistence, DOM data attributes,
and logging without overloading block ids as path proxies.

---

## 6. Visual feedback (Phase 2B.3)

### 6.1 DragOverlay preview

`<DragOverlayPreview>` is a stripped card (block-type icon + display
name + id) rendered inside dnd-kit's `<DragOverlay>`. It's
deliberately not a full clone of `BlockTreeRow` — Move ↑↓ / ⋮ menu /
chevron buttons carry no meaning during drag, so a full-row clone
would be visually busy. Shadow-2xl + primary-tinted border lift it
off the canvas; the original row stays at opacity 0.4 as a
placeholder, so admins see both "where I started" and "where I'm
headed."

Drop animation: `{ duration: 150, easing: "cubic-bezier(0.18, 0.67,
0.6, 1.22)" }` — a brief flick with a touch of overshoot.

### 6.2 Drop-line on the over-item

`BlockTreeItem` reads `sortable.isOver` and stamps
`data-over="true"` on its `<li>`. A 2px primary-coloured line above
the item is rendered via a Tailwind `::before` pseudo with a 150ms
transition. Position is "always above" for now; cursor-based
above-vs-below resolution is deferred (see §10).

### 6.3 Container highlight on the over-slot

`BlockTreeSlot`'s wrapping `<div ref={droppable.setNodeRef}>` applies
`bg-primary/5 ring-1 ring-primary/30` (with `transition-150`) when
`droppable.isOver`. Empty slots additionally pulse via
`EmptyDropZone`'s `isOver` prop (`border-primary` + `animate-pulse`).

---

## 7. Performance + Accessibility (Phase 2B.4)

### 7.1 `React.memo` on `BlockTreeItem`

A custom comparator skips re-render unless one of the fields the item
actually reads has changed: `block` reference, `depth`,
`siblingIndex`, `siblingCount`, `path.length`, `onToggleExpand`, the
boolean `state.selectedId === thisBlockId`, the boolean
`expandedIds.has(thisBlockId)`. The state reference flips every
mutation, but the comparator extracts only the booleans this item
depends on, so unrelated mutations no longer ripple through. A
100-block tree drops from 100 wasted renders per mutation to just the
affected subtree.

### 7.2 Stale `expandedIds` cleanup

`BlockTree` runs a `useEffect` on `state.schema` that walks the new
tree, collects valid container ids, and prunes any `expandedIds`
no longer present. Guards against the "ghost expand" hazard after
`replaceSchema` (Swagger wizard) or `removeBlockAt` on a container.
Returns the same `Set` reference when nothing was pruned, so the
effect doesn't trigger an extra render cycle.

### 7.3 Screen-reader announcements

`BlockTreeDndProvider` passes an `accessibility.announcements`
bundle covering `onDragStart` / `onDragOver` / `onDragEnd` /
`onDragCancel`. dnd-kit's built-in Announcer renders these strings
into a visually-hidden aria-live region — no extra DOM owned by the
canvas. The strings reference `active.id` / `over.id` directly rather
than reaching back into the schema for friendlier names; the bundle
stays pure (no schema reads from inside the context).

### 7.4 Dynamic aria-label on `DragHandle`

`DragHandle` accepts `blockLabel` + `siblingIndex` + `siblingCount`
and composes `Drag <label> (item N of M)` — e.g. "Drag Heading (item
2 of 5)". `BlockTreeItem` hands the registry-resolved `displayName`
and sibling position down so the handle's announcement is contextual
for a screen-reader user.

---

## 8. Recipes

### 8.1 Adding a new block type

Follow [`extending.md`](./extending.md) — no canvas-specific work is
needed beyond registering the block. The DnD wiring lights up
automatically once the registry returns a definition; the tree
renders the block via the same `BlockDefinition.Render` the
PageRenderer uses.

If the new block is a **container** (holds nested blocks), its schema
must expose one of the recognised child arrays (`blocks`, `tabs[].
blocks`, `items[].blocks`). Add a case in
`tree/container-helpers.ts::getContainerSlots` so the tree walker can
find it. Otherwise the canvas treats it as a leaf.

### 8.2 Customising drop validation

`tree/validation.ts::canDropInto` is the single chokepoint. Adding a
rule (e.g. "no table inside table") looks like:

```ts
// inside canDropInto, before slot-kind checks:
if (asBlockNode(dragged).type === "table" && asBlockNode(target).type === "table") {
  return { allowed: false, reason: "table-inside-table" }
}
```

Then surface the reason in the warning toast by adding it to the
i18n bundle. No other layer needs to know — the rule fires for both
drag drops and Move-to submenu picks.

### 8.3 Triggering a programmatic drag

dnd-kit does not expose a "drag from outside" API. The supported
imperative paths are:

- `state.moveBlock(from, parent, slot, index)` — for "move to here"
  intents (Move-to submenu uses this).
- `state.insertBlock(parent, slot, index, block)` — for "drop a new
  block here" intents (palette uses this).

If you need a fake drag for an onboarding tour, animate the row
manually with a CSS transform and dispatch `state.moveBlock` on
animation end. Don't synthesise pointer events into dnd-kit.

---

## 9. Testing strategy

### 9.1 Mock pattern

jsdom can't reproduce the pointer-event sequence dnd-kit's sensors
listen to, so unit tests mock the dnd-kit modules with stubs that:

- record useSortable args (`mocks.lastSortableArgs`)
- expose controllable returns (`isDragging`, `isOver`)
- count calls (`useSortableCallCount`) for memoisation proofs

Pattern lives in `canvas/components/__tests__/BlockTreeItem.test.tsx`
and is reused (with smaller surfaces) in the other tree tests. The
shared `test-utils.tsx` builds `makeMockState(schema, overrides)`
that satisfies the `useCanvasState` return shape with vi.fn() stubs.

### 9.2 Render-count benchmarks

`canvas/components/__tests__/BlockTreeItem-perf.test.tsx` proves the
`React.memo` comparator by mounting a 50-block tree, counting
`useSortable` invocations, then re-rendering with an unrelated state
change and asserting the call count grows by at most 1 (the affected
item). Cheap, deterministic, no Profiler API needed.

### 9.3 Real pointer flow

Activation distance + sensor wiring are exercised in the Playwright
suite, not the unit tests. E2E specs live in `e2e/page-builder-*.
spec.ts`.

### 9.4 Architecture validation

`scripts/validate-architecture.ts` (run via `npm run validate`)
enforces the import graph — the canvas can only reach `core`, `ui`,
`infra`, `shared` plus its own subtree.

---

## 10. Known limitations + future work

| Topic | Status | Notes |
| --- | --- | --- |
| Keyboard sensor | Deferred to Phase 2C | Visible Move ↑↓ buttons + Move-to submenu cover the same affordances today. |
| Touch / mobile drag | Not planned | The canvas is desktop-only by spec. |
| Drop position above-vs-below cursor | Deferred | Drop-line is "always above" for now. dnd-kit's `over` event carries pointer rect; resolution is a CSS-only change once we want it. |
| Auto-expand container on hover | Deferred | Today an admin pre-expands manually. Hover-to-expand needs a timer + cancellation when the cursor leaves before threshold. |
| Invalid-drop cursor | Deferred | Requires `onDragOver` to pre-compute validity. Today the drop just bounces back with a warning toast. |
| Real Profiler measurements | Phase 2F | Today: render-count proof in `BlockTreeItem-perf.test.tsx`. A `<Profiler onRender>` integration belongs in the hardening sprint. |
| Stale e2e specs | Phase 2F | `e2e/page-builder-*.spec.ts` were written against the pre-Phase 2A flat list. They still pass on the new tree but don't exercise drag-and-drop. |
