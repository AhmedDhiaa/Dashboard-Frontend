import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BlockTreeDndProvider } from "../BlockTreeDndProvider"

// The actual `@dnd-kit/core` module is mocked so the test asserts on
// _what the provider passes to DndContext_ — the wiring contract — not
// on Radix-style pointer-event semantics, which jsdom can't reproduce
// faithfully. Activation distance is exercised by the E2E suite.
const mocks = vi.hoisted(() => ({
  dndContextProps: undefined as Record<string, unknown> | undefined,
  sensorConfigs: [] as Array<{ sensor: unknown; options: unknown }>,
  mouseSensorMarker: { __sensorKind: "MouseSensor" },
  touchSensorMarker: { __sensorKind: "TouchSensor" },
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
    mocks.dndContextProps = props
    return <div data-testid="dnd-context-root">{children}</div>
  },
  // DragOverlay renders its children when an active drag exists; the
  // mock renders them unconditionally so the children prop is testable.
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay-mock">{children}</div>,
  MouseSensor: mocks.mouseSensorMarker,
  TouchSensor: mocks.touchSensorMarker,
  useSensor: (sensor: unknown, options: unknown) => {
    mocks.sensorConfigs.push({ sensor, options })
    return { sensor, options }
  },
  useSensors: (...sensors: unknown[]) => sensors,
}))

describe("BlockTreeDndProvider", () => {
  it("renders its children inside the DndContext root", () => {
    render(
      <BlockTreeDndProvider>
        <span data-testid="child-marker">child</span>
      </BlockTreeDndProvider>,
    )
    expect(screen.getByTestId("dnd-context-root")).toBeInTheDocument()
    expect(screen.getByTestId("child-marker")).toBeInTheDocument()
    expect(screen.getByTestId("block-tree-dnd-provider")).toBeInTheDocument()
  })

  it("passes the onDragStart / onDragEnd / onDragOver / onDragCancel props through to DndContext", () => {
    mocks.dndContextProps = undefined
    const onDragStart = vi.fn()
    const onDragEnd = vi.fn()
    const onDragOver = vi.fn()
    const onDragCancel = vi.fn()
    render(
      <BlockTreeDndProvider
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragCancel={onDragCancel}
      >
        <span />
      </BlockTreeDndProvider>,
    )
    const props = (mocks.dndContextProps ?? {}) as Record<string, unknown>
    expect(props.onDragStart).toBe(onDragStart)
    expect(props.onDragEnd).toBe(onDragEnd)
    expect(props.onDragOver).toBe(onDragOver)
    expect(props.onDragCancel).toBe(onDragCancel)
  })

  it("enables auto-scroll on the DndContext", () => {
    mocks.dndContextProps = undefined
    render(
      <BlockTreeDndProvider>
        <span />
      </BlockTreeDndProvider>,
    )
    const props = (mocks.dndContextProps ?? {}) as Record<string, unknown>
    expect(props.autoScroll).toBe(true)
  })

  it("registers a MouseSensor with a 5px activation distance", () => {
    mocks.sensorConfigs = []
    render(
      <BlockTreeDndProvider>
        <span />
      </BlockTreeDndProvider>,
    )
    expect(mocks.sensorConfigs).toHaveLength(1)
    expect(mocks.sensorConfigs[0]!.sensor).toBe(mocks.mouseSensorMarker)
    expect(mocks.sensorConfigs[0]!.options).toEqual({ activationConstraint: { distance: 5 } })
  })

  it("does NOT register a TouchSensor (desktop-only per Phase 2B spec)", () => {
    mocks.sensorConfigs = []
    render(
      <BlockTreeDndProvider>
        <span />
      </BlockTreeDndProvider>,
    )
    const touchUsed = mocks.sensorConfigs.some(c => c.sensor === mocks.touchSensorMarker)
    expect(touchUsed).toBe(false)
  })
})

describe("BlockTreeDndProvider — DragOverlay rendering", () => {
  it("renders the DragOverlayPreview inside DragOverlay when activeBlock is supplied", () => {
    const block = {
      id: "h-active",
      type: "heading",
      text: { en: "Hi", ar: "مرحبا" },
      level: 2,
      hidden: false,
    }
    render(
      <BlockTreeDndProvider activeBlock={block as never}>
        <span />
      </BlockTreeDndProvider>,
    )
    expect(screen.getByTestId("drag-overlay-mock")).toBeInTheDocument()
    expect(screen.getByTestId("drag-overlay-preview")).toBeInTheDocument()
    expect(screen.getByText("h-active")).toBeInTheDocument()
  })

  it("renders the DragOverlay empty when activeBlock is null", () => {
    render(
      <BlockTreeDndProvider activeBlock={null}>
        <span />
      </BlockTreeDndProvider>,
    )
    expect(screen.getByTestId("drag-overlay-mock")).toBeInTheDocument()
    expect(screen.queryByTestId("drag-overlay-preview")).toBeNull()
  })
})

describe("BlockTreeDndProvider — screen-reader announcements", () => {
  it("passes an accessibility config with an announcements bundle to DndContext", () => {
    mocks.dndContextProps = undefined
    render(
      <BlockTreeDndProvider>
        <span />
      </BlockTreeDndProvider>,
    )
    const props = (mocks.dndContextProps ?? {}) as Record<string, unknown>
    const accessibility = props.accessibility as { announcements?: Record<string, unknown> } | undefined
    expect(accessibility).toBeDefined()
    expect(accessibility?.announcements).toBeDefined()
  })

  it("the announcements bundle exposes onDragStart / onDragOver / onDragEnd / onDragCancel", () => {
    mocks.dndContextProps = undefined
    render(
      <BlockTreeDndProvider>
        <span />
      </BlockTreeDndProvider>,
    )
    const props = (mocks.dndContextProps ?? {}) as Record<string, unknown>
    const announcements = (props.accessibility as { announcements: Record<string, unknown> }).announcements
    expect(typeof announcements.onDragStart).toBe("function")
    expect(typeof announcements.onDragOver).toBe("function")
    expect(typeof announcements.onDragEnd).toBe("function")
    expect(typeof announcements.onDragCancel).toBe("function")
    // Sanity-check that the canned strings include the active id so a
    // screen-reader hears something useful.
    const onDragStart = announcements.onDragStart as (e: { active: { id: string } }) => string | undefined
    expect(onDragStart({ active: { id: "h-test" } })).toContain("h-test")
  })
})
