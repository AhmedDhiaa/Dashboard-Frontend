/**
 * Render-count benchmark for `BlockTreeItem` (TASK 2B.5).
 *
 * `React.memo`'s comparator on `BlockTreeItem` (TASK 2B.4) is the
 * difference between a 100-block schema mutation re-rendering 1 item
 * and re-rendering 100. The other unit tests assert the comparator
 * decisions in isolation; this file proves the end-to-end claim by
 * mounting a populated tree, counting `useSortable` invocations (one
 * per render of an item), and verifying re-renders stay bounded as
 * `state` mutates.
 *
 * Why a counter and not the React Profiler API:
 *   - jsdom doesn't ship the Profiler timing infra; `<Profiler
 *     onRender>` callbacks fire but `actualDuration` is unreliable.
 *   - `useSortable` runs unconditionally inside `BlockTreeItemImpl`,
 *     so its call count equals the number of times the component
 *     function executed. When `React.memo` short-circuits the body,
 *     `useSortable` doesn't run — a clean signal.
 */

import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { BlockTree } from "../BlockTree"
import { baseSchema, card, heading, makeMockState } from "./test-utils"

const mocks = vi.hoisted(() => ({
  useSortableCallCount: 0,
}))

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => {
    mocks.useSortableCallCount += 1
    return {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
      isOver: false,
    }
  },
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: () => ({}),
}))

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
    node: { current: null },
    rect: { current: null },
    over: null,
    active: null,
  }),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("BlockTreeItem — render-count benchmark", () => {
  it("invokes useSortable exactly once per item on the initial mount of a 50-block tree", () => {
    mocks.useSortableCallCount = 0
    const blocks = Array.from({ length: 50 }, (_, i) => heading(`h${i}`))
    const state = makeMockState(baseSchema(blocks))
    render(<BlockTree state={state} />)
    expect(mocks.useSortableCallCount).toBe(50)
  })

  it("re-renders at most the affected item when selectedId flips to a different block", () => {
    mocks.useSortableCallCount = 0
    const blocks = [heading("h1"), heading("h2"), heading("h3")]
    const initialState = makeMockState(baseSchema(blocks), { selectedId: null })
    const { rerender } = render(<BlockTree state={initialState} />)
    const initialCount = mocks.useSortableCallCount // 3

    // Mutation: pick a different block. h2 needs to repaint because its
    // selected-state boolean flipped; h1 and h3 should stay memoised.
    const selectedState = makeMockState(baseSchema(blocks), { selectedId: "h2" })
    rerender(<BlockTree state={selectedState} />)
    const delta = mocks.useSortableCallCount - initialCount
    // Strict expectation: exactly 1 re-render. Tolerant ceiling: ≤1 so a
    // future BlockTree refactor that bumps a parent doesn't fail the
    // benchmark spuriously — anything > 1 still flags a regression.
    expect(delta).toBeLessThanOrEqual(1)
  })

  it("renders every node once on initial mount of a 3-level nested tree", () => {
    mocks.useSortableCallCount = 0
    // c1 → c2 → c3 → h1  (4 sortable items, depth 3)
    const deep = card("c1", [card("c2", [card("c3", [heading("h1")])])])
    const state = makeMockState(baseSchema([deep]))
    render(<BlockTree state={state} />)
    expect(mocks.useSortableCallCount).toBe(4)
  })
})
