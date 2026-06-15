import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactNode } from "react"
import {
  PageBuilderRenderProvider,
  usePageBuilderRender,
  useLocalizedText,
  type RenderLocale,
} from "../../../renderer/PageBuilderRenderContext"
import { InlineLocalizedText } from "../InlineLocalizedText"

const value = (en: string, ar: string) => ({ en, ar })

// ─── view mode (isEditing=false) ────────────────────────────────────────────

describe("InlineLocalizedText — view mode (isEditing=false)", () => {
  it("renders plain text in the active locale (en, default context)", () => {
    render(<InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "مرحبا")} />)
    expect(screen.getByText("Hello")).toBeInTheDocument()
    expect(screen.queryByText("مرحبا")).not.toBeInTheDocument()
  })

  it("renders plain text in ar locale when provider sets locale='ar'", () => {
    render(
      <PageBuilderRenderProvider locale="ar" isEditing={false}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "مرحبا")} />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByText("مرحبا")).toBeInTheDocument()
    expect(screen.queryByText("Hello")).not.toBeInTheDocument()
  })

  it("renders empty string when value missing — no crash", () => {
    const { container } = render(<InlineLocalizedText blockId="b1" fieldKey="text" value={value("", "")} />)
    expect(container.querySelector("span")).toBeInTheDocument()
  })

  it("falls back to .en when .ar is empty", () => {
    render(
      <PageBuilderRenderProvider locale="ar">
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("English only", "")} />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByText("English only")).toBeInTheDocument()
  })

  it("uses the `as` prop for the rendered tag", () => {
    const { container } = render(
      <InlineLocalizedText blockId="h1" fieldKey="text" value={value("Title", "")} as="h1" />,
    )
    expect(container.querySelector("h1")).not.toBeNull()
    expect(container.querySelector("span")).toBeNull()
  })

  it("does not expose role='button' nor hover-edit affordances in view mode", () => {
    render(<InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "")} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByTestId("inline-display-b1-text")).not.toBeInTheDocument()
  })
})

// ─── display mode (isEditing=true, not focused) ─────────────────────────────

describe("InlineLocalizedText — display mode (isEditing=true, not focused)", () => {
  it("renders the text as a clickable button (role=button, tabIndex=0)", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "")} />
      </PageBuilderRenderProvider>,
    )
    const button = screen.getByTestId("inline-display-b1-text")
    expect(button).toHaveAttribute("role", "button")
    expect(button).toHaveAttribute("tabindex", "0")
  })

  it("applies hover/ring classes on the display element", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "")} />
      </PageBuilderRenderProvider>,
    )
    const button = screen.getByTestId("inline-display-b1-text")
    expect(button.className).toMatch(/hover:bg-primary/)
  })

  it("click → swaps to focused <input>", async () => {
    const user = userEvent.setup()
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "")} />
      </PageBuilderRenderProvider>,
    )
    await user.click(screen.getByTestId("inline-display-b1-text"))
    expect(screen.getByTestId("inline-edit-b1-text")).toBeInTheDocument()
  })

  it("Enter/Space on display element → swaps to focused <input>", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hello", "")} />
      </PageBuilderRenderProvider>,
    )
    const display = screen.getByTestId("inline-display-b1-text")
    fireEvent.keyDown(display, { key: "Enter" })
    expect(screen.getByTestId("inline-edit-b1-text")).toBeInTheDocument()
  })

  it("placeholder shown when locale value is empty", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("", "")} placeholder="Type here" />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByText("Type here")).toBeInTheDocument()
  })
})

// ─── edit mode (focused) ────────────────────────────────────────────────────

describe("InlineLocalizedText — edit mode (focused)", () => {
  function enterEdit() {
    fireEvent.click(screen.getByTestId("inline-display-b1-text"))
  }

  it("renders <input> for single-line variant", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const el = screen.getByTestId("inline-edit-b1-text")
    expect(el.tagName).toBe("INPUT")
  })

  it("renders <textarea> when multiline", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} multiline />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const el = screen.getByTestId("inline-edit-b1-text")
    expect(el.tagName).toBe("TEXTAREA")
  })

  it("auto-focuses the input on entering edit mode", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    expect(screen.getByTestId("inline-edit-b1-text")).toBe(document.activeElement)
  })

  it("typing only updates the local draft (no commit yet)", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    fireEvent.change(input, { target: { value: "Hi there" } })
    expect(input.value).toBe("Hi there")
    expect(onEdit).not.toHaveBeenCalled()
  })

  it("blur with changed draft → onEditField called with the merged LocalizedString", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "Salam")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    fireEvent.change(input, { target: { value: "Hello" } })
    fireEvent.blur(input)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith("b1", "text", { en: "Hello", ar: "Salam" })
  })

  it("blur with unchanged draft → onEditField NOT called", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    fireEvent.blur(screen.getByTestId("inline-edit-b1-text"))
    expect(onEdit).not.toHaveBeenCalled()
  })

  it("Enter key commits the draft (single-line)", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    fireEvent.change(input, { target: { value: "Done" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith("b1", "text", { en: "Done", ar: "" })
  })

  it("Ctrl+Enter commits in multiline; plain Enter does not", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} multiline />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const ta = screen.getByTestId("inline-edit-b1-text") as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: "Multi\nLine" } })
    fireEvent.keyDown(ta, { key: "Enter" })
    expect(onEdit).not.toHaveBeenCalled()
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true })
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith("b1", "text", { en: "Multi\nLine", ar: "" })
  })

  it("Escape reverts the draft and exits edit mode without committing", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Original", "")} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    fireEvent.change(input, { target: { value: "Changed" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByTestId("inline-display-b1-text")).toHaveTextContent("Original")
  })

  it("maxLength is enforced on the underlying input", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <InlineLocalizedText blockId="b1" fieldKey="text" value={value("Hi", "")} maxLength={10} />
      </PageBuilderRenderProvider>,
    )
    enterEdit()
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    expect(input.maxLength).toBe(10)
  })
})

// ─── external value sync ────────────────────────────────────────────────────

describe("InlineLocalizedText — external value sync", () => {
  function ControlledHarness({
    initialValue,
    initialLocale = "en",
    onEdit,
  }: {
    initialValue: { en: string; ar: string }
    initialLocale?: RenderLocale
    onEdit?: (id: string, key: string, v: { en: string; ar: string }) => void
  }) {
    const [val, setVal] = useState(initialValue)
    const [loc, setLoc] = useState<RenderLocale>(initialLocale)
    return (
      <>
        <button data-testid="bump-en" onClick={() => setVal(prev => ({ ...prev, en: "External EN" }))} />
        <button data-testid="bump-ar" onClick={() => setVal(prev => ({ ...prev, ar: "External AR" }))} />
        <button data-testid="flip-locale" onClick={() => setLoc(l => (l === "en" ? "ar" : "en"))} />
        <PageBuilderRenderProvider locale={loc} isEditing onEditField={onEdit ?? (() => {})}>
          <InlineLocalizedText blockId="b1" fieldKey="text" value={val} />
        </PageBuilderRenderProvider>
      </>
    )
  }

  it("value changes while NOT focused → draft syncs", () => {
    render(<ControlledHarness initialValue={value("Old", "Old AR")} />)
    expect(screen.getByTestId("inline-display-b1-text")).toHaveTextContent("Old")
    fireEvent.click(screen.getByTestId("bump-en"))
    expect(screen.getByTestId("inline-display-b1-text")).toHaveTextContent("External EN")
    fireEvent.click(screen.getByTestId("inline-display-b1-text"))
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    expect(input.value).toBe("External EN")
  })

  it("value changes while focused → user's draft is preserved", () => {
    render(<ControlledHarness initialValue={value("Old", "")} />)
    fireEvent.click(screen.getByTestId("inline-display-b1-text"))
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    fireEvent.change(input, { target: { value: "User typing" } })
    expect(input.value).toBe("User typing")
    fireEvent.click(screen.getByTestId("bump-en"))
    expect((screen.getByTestId("inline-edit-b1-text") as HTMLInputElement).value).toBe("User typing")
  })

  it("locale change while NOT focused → draft syncs to the new locale's value", () => {
    render(<ControlledHarness initialValue={value("English", "Arabic")} />)
    fireEvent.click(screen.getByTestId("flip-locale"))
    expect(screen.getByTestId("inline-display-b1-text")).toHaveTextContent("Arabic")
    fireEvent.click(screen.getByTestId("inline-display-b1-text"))
    const input = screen.getByTestId("inline-edit-b1-text") as HTMLInputElement
    expect(input.value).toBe("Arabic")
  })
})

// ─── PageBuilderRenderContext ───────────────────────────────────────────────

describe("PageBuilderRenderContext", () => {
  it("default value: locale='en', isEditing=false", () => {
    function Probe() {
      const ctx = usePageBuilderRender()
      return (
        <span data-testid="probe">
          {ctx.locale}-{String(ctx.isEditing)}
        </span>
      )
    }
    render(<Probe />)
    expect(screen.getByTestId("probe")).toHaveTextContent("en-false")
  })

  it("provider overrides apply", () => {
    function Probe() {
      const ctx = usePageBuilderRender()
      return (
        <span data-testid="probe">
          {ctx.locale}-{String(ctx.isEditing)}
        </span>
      )
    }
    render(
      <PageBuilderRenderProvider locale="ar" isEditing>
        <Probe />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByTestId("probe")).toHaveTextContent("ar-true")
  })

  it("useLocalizedText returns the active locale's value", () => {
    function Probe({ children }: { children: ReactNode }) {
      return <span data-testid="probe">{children}</span>
    }
    function ReadOut() {
      const text = useLocalizedText({ en: "Hello", ar: "مرحبا" })
      return <Probe>{text}</Probe>
    }
    render(
      <PageBuilderRenderProvider locale="ar">
        <ReadOut />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByTestId("probe")).toHaveTextContent("مرحبا")
  })

  it("useLocalizedText falls back to .en when the active locale value is empty", () => {
    function ReadOut() {
      const text = useLocalizedText({ en: "English fallback", ar: "" })
      return <span data-testid="probe">{text}</span>
    }
    render(
      <PageBuilderRenderProvider locale="ar">
        <ReadOut />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByTestId("probe")).toHaveTextContent("English fallback")
  })
})
