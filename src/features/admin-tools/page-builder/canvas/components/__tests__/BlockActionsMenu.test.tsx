import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BlockActionsMenu } from "../BlockActionsMenu"
import { baseSchema, card, heading, makeMockState } from "./test-utils"
import type { BlockPath } from "../../tree"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const rootPath = (index: number): BlockPath => [{ kind: "root", index }]

// Radix DropdownMenu listens to pointer events; userEvent simulates the
// full sequence so the menu actually opens under jsdom.
let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  user = userEvent.setup()
})

describe("BlockActionsMenu", () => {
  it("renders the trigger button", () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(<BlockActionsMenu block={block} path={rootPath(0)} state={state} />)
    expect(screen.getByTestId("tree-actions-h1")).toBeInTheDocument()
  })

  it("opens the menu and calls duplicateBlockAt on Duplicate", async () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(<BlockActionsMenu block={block} path={rootPath(0)} state={state} />)
    await user.click(screen.getByTestId("tree-actions-h1"))
    await user.click(screen.getByTestId("tree-action-h1-duplicate"))
    expect(state.duplicateBlockAt).toHaveBeenCalledWith(rootPath(0))
  })

  it("calls removeBlockAt on Delete", async () => {
    const block = heading("h1")
    const state = makeMockState(baseSchema([block]))
    render(<BlockActionsMenu block={block} path={rootPath(0)} state={state} />)
    await user.click(screen.getByTestId("tree-actions-h1"))
    await user.click(screen.getByTestId("tree-action-h1-delete"))
    expect(state.removeBlockAt).toHaveBeenCalledWith(rootPath(0))
  })

  it("renders a Move-to submenu trigger when drop targets exist", async () => {
    // Two root blocks → moving h1 has root-position drop targets.
    const blocks = [heading("h1"), card("c1", [])]
    const state = makeMockState(baseSchema(blocks))
    render(<BlockActionsMenu block={blocks[0]!} path={rootPath(0)} state={state} />)
    await user.click(screen.getByTestId("tree-actions-h1"))
    expect(screen.getByTestId("tree-action-h1-move-to")).toBeInTheDocument()
  })

  it("opens the Move-to submenu and routes a target click through state.moveBlock", async () => {
    const blocks = [heading("h1"), card("c1", [])]
    const state = makeMockState(baseSchema(blocks))
    render(<BlockActionsMenu block={blocks[0]!} path={rootPath(0)} state={state} />)
    await user.click(screen.getByTestId("tree-actions-h1"))
    await user.hover(screen.getByTestId("tree-action-h1-move-to"))
    // Wait for the submenu to mount; Radix opens on hover.
    const firstTarget = await screen.findByTestId("tree-action-h1-move-target-0")
    // Radix DropdownMenu sub-items dispatch onClick on pointerUp inside
    // the item; userEvent.click occasionally drops the event in jsdom.
    // fireEvent.click on the resolved DOM node bypasses pointer plumbing.
    fireEvent.click(firstTarget)
    expect(state.moveBlock).toHaveBeenCalled()
  })
})
