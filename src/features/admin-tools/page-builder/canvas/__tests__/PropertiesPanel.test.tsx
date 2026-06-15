import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PropertiesPanel } from "../PropertiesPanel"
import "../../registry/block-registry"
import type { BlockSchema } from "../../schema/block-schema"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const sampleHeadingLiteral = {
  id: "h-1",
  type: "heading" as const,
  text: { en: "Welcome", ar: "أهلا" },
  level: 2,
  hidden: false,
}
const sampleHeading = sampleHeadingLiteral as unknown as BlockSchema

describe("PropertiesPanel — empty state + tabs", () => {
  it("shows a placeholder when no block is selected", () => {
    render(<PropertiesPanel block={null} onChange={vi.fn()} />)
    expect(screen.getByTestId("properties-panel-empty")).toBeInTheDocument()
  })

  it("opens on the Form tab by default and exposes the Advanced (JSON) tab", () => {
    render(<PropertiesPanel block={sampleHeading} onChange={vi.fn()} />)
    expect(screen.getByTestId("properties-panel")).toBeInTheDocument()
    expect(screen.getByTestId("properties-tab-form")).toBeInTheDocument()
    expect(screen.getByTestId("properties-tab-json")).toBeInTheDocument()
    // Form tab is rendered (Advanced is hidden until clicked).
    expect(screen.getByTestId("properties-form")).toBeInTheDocument()
  })
})

describe("PropertiesPanel — Form tab", () => {
  it("renders schema-driven fields in place of the JSON textarea (heading: text.en + text.ar)", () => {
    render(<PropertiesPanel block={sampleHeading} onChange={vi.fn()} />)
    // SchemaFormRenderer extracts the localizedString as text.en + text.ar
    // (both string fields). The dot-path field NAMES surface as part of
    // the rendered DOM via input[name=...]; verify both exist.
    const { container } = render(<PropertiesPanel block={sampleHeading} onChange={vi.fn()} />)
    expect(container.querySelector('input[name="text.en"]')).toBeTruthy()
    expect(container.querySelector('input[name="text.ar"]')).toBeTruthy()
  })

  it("calls onChange with the validated block on Apply (preserving id + type)", async () => {
    const onChange = vi.fn()
    const { container } = render(<PropertiesPanel block={sampleHeading} onChange={onChange} />)
    // Tweak text.en and click Apply.
    const enInput = container.querySelector('input[name="text.en"]') as HTMLInputElement
    fireEvent.change(enInput, { target: { value: "Updated title" } })
    fireEvent.click(screen.getByTestId("properties-apply"))
    // RHF.handleSubmit is async; wait a microtask for the resolver to run.
    await new Promise(r => setTimeout(r, 50))
    expect(onChange).toHaveBeenCalled()
    const [calledId, payload] = onChange.mock.calls[onChange.mock.calls.length - 1]!
    expect(calledId).toBe("h-1")
    expect(payload).toMatchObject({ id: "h-1", type: "heading" })
  })
})

describe("PropertiesPanel — Advanced (JSON) tab", () => {
  it("hydrates the JSON editor with the selected block's props after switching tabs", async () => {
    render(<PropertiesPanel block={sampleHeading} onChange={vi.fn()} />)
    await userEvent.setup().click(screen.getByTestId("properties-tab-json"))
    const editor = (await screen.findByTestId("properties-json-editor")) as HTMLTextAreaElement
    expect(editor.value).toContain('"type": "heading"')
    expect(editor.value).toContain('"Welcome"')
  })

  it("calls onChange with parsed + Zod-validated props on Apply", async () => {
    const onChange = vi.fn()
    render(<PropertiesPanel block={sampleHeading} onChange={onChange} />)
    await userEvent.setup().click(screen.getByTestId("properties-tab-json"))
    const editor = (await screen.findByTestId("properties-json-editor")) as HTMLTextAreaElement
    const updated = JSON.stringify({ ...sampleHeadingLiteral, level: 3 }, null, 2)
    fireEvent.change(editor, { target: { value: updated } })
    fireEvent.click(screen.getByTestId("properties-apply-json"))
    expect(onChange).toHaveBeenCalledWith("h-1", expect.objectContaining({ level: 3 }))
  })

  it("blocks invalid JSON and renders the parse error inline", async () => {
    const onChange = vi.fn()
    render(<PropertiesPanel block={sampleHeading} onChange={onChange} />)
    await userEvent.setup().click(screen.getByTestId("properties-tab-json"))
    const editor = (await screen.findByTestId("properties-json-editor")) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: "{ not valid json" } })
    fireEvent.click(screen.getByTestId("properties-apply-json"))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("properties-json-error")).toBeInTheDocument()
  })

  it("blocks Zod-invalid props (e.g. level=99)", async () => {
    const onChange = vi.fn()
    render(<PropertiesPanel block={sampleHeading} onChange={onChange} />)
    await userEvent.setup().click(screen.getByTestId("properties-tab-json"))
    const editor = (await screen.findByTestId("properties-json-editor")) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: JSON.stringify({ ...sampleHeadingLiteral, level: 99 }) } })
    fireEvent.click(screen.getByTestId("properties-apply-json"))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("properties-json-error")).toBeInTheDocument()
  })
})
