import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { headingBlockDefinition } from "../heading-block"
import { textBlockDefinition } from "../text-block"
import { buttonBlockDefinition } from "../button-block"
import { dividerBlockDefinition } from "../divider-block"
import { spacerBlockDefinition } from "../spacer-block"
import { PageBuilderRenderProvider } from "../../../renderer/PageBuilderRenderContext"

// Button + Card primitives consume useTheme; short-circuit it so unit
// tests don't need a ThemeProvider tree.
vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// button-block reads usePermissionContext for the per-button permission
// gate. The runtime path requires the user to be admin or to be granted
// the permission key. Stub it so tests don't drag in the auth provider.
vi.mock("@/core/auth/context/PermissionContext", () => ({
  usePermissionContext: () => ({ isAdmin: true, isGranted: () => true, isLoading: false }),
}))

// ─── headingBlock ──────────────────────────────────────────────────────────

describe("headingBlock — Render (view mode)", () => {
  const { Render, defaultProps } = headingBlockDefinition

  it("renders an h2 by default", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument()
  })

  it("respects the `level` prop", () => {
    render(<Render {...defaultProps} level={1} />)
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the EN copy by default (no provider)", () => {
    render(<Render {...defaultProps} text={{ en: "Hello", ar: "مرحبا" }} />)
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument()
  })

  it("preserves heading size + tracking classes", () => {
    render(<Render {...defaultProps} level={1} />)
    expect(screen.getByRole("heading", { level: 1 }).className).toMatch(/text-4xl/)
  })
})

describe("headingBlock — Render (edit mode)", () => {
  const { Render, defaultProps } = headingBlockDefinition

  it("exposes the click-to-edit affordance when isEditing=true", () => {
    render(
      <PageBuilderRenderProvider isEditing>
        <Render {...defaultProps} />
      </PageBuilderRenderProvider>,
    )
    expect(screen.getByTestId(`inline-display-${defaultProps.id}-text`)).toBeInTheDocument()
  })

  it("commits inline edit via onEditField with the fieldKey 'text'", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <Render {...defaultProps} text={{ en: "Old", ar: "" }} />
      </PageBuilderRenderProvider>,
    )
    fireEvent.click(screen.getByTestId(`inline-display-${defaultProps.id}-text`))
    const input = screen.getByTestId(`inline-edit-${defaultProps.id}-text`) as HTMLInputElement
    fireEvent.change(input, { target: { value: "New" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onEdit).toHaveBeenCalledWith(defaultProps.id, "text", { en: "New", ar: "" })
  })
})

// ─── textBlock ──────────────────────────────────────────────────────────────

describe("textBlock — Render (view mode)", () => {
  const { Render, defaultProps } = textBlockDefinition

  it("renders a paragraph with the EN copy", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByText(defaultProps.text.en)).toBeInTheDocument()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })

  it("preserves the variant class", () => {
    render(<Render {...defaultProps} variant="muted" />)
    expect(screen.getByText(defaultProps.text.en).className).toMatch(/text-muted-foreground/)
  })
})

describe("textBlock — Render (edit mode)", () => {
  const { Render, defaultProps } = textBlockDefinition

  it("renders a <textarea> when focused (multiline=true)", () => {
    render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <Render {...defaultProps} />
      </PageBuilderRenderProvider>,
    )
    fireEvent.click(screen.getByTestId(`inline-display-${defaultProps.id}-text`))
    expect(screen.getByTestId(`inline-edit-${defaultProps.id}-text`).tagName).toBe("TEXTAREA")
  })
})

// ─── buttonBlock ───────────────────────────────────────────────────────────

describe("buttonBlock — Render (view mode)", () => {
  const { Render, defaultProps } = buttonBlockDefinition

  it("renders a real <button> at runtime", () => {
    const { container } = render(<Render {...defaultProps} />)
    expect(container.querySelector("button")).not.toBeNull()
  })

  it("uses button.label.en at runtime", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByRole("button", { name: defaultProps.button.label.en })).toBeInTheDocument()
  })
})

describe("buttonBlock — Render (edit mode)", () => {
  const { Render, defaultProps } = buttonBlockDefinition

  it("swaps the real <button> for a styled <span> wrapper to avoid <button> nesting", () => {
    const { container } = render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <Render {...defaultProps} />
      </PageBuilderRenderProvider>,
    )
    // No actual <button> DOM elements in edit mode — only role=button
    // on the InlineLocalizedText display element.
    expect(container.querySelector("button")).toBeNull()
  })

  it("applies buttonVariants classes to the wrapper span", () => {
    const { container } = render(
      <PageBuilderRenderProvider isEditing onEditField={() => {}}>
        <Render {...defaultProps} button={{ ...defaultProps.button, variant: "outline" }} />
      </PageBuilderRenderProvider>,
    )
    const wrapper = container.querySelector('span[role="presentation"]')
    expect(wrapper).not.toBeNull()
    // buttonVariants("outline") was tightened from `border-2 border-primary/40`
    // to the more neutral `border-border bg-background` so the outline
    // button no longer screams primary-tinted next to a primary CTA.
    // Assert the wrapper still carries the variant token (`border-border`)
    // and a background reset, which together cover both intents:
    // "the variant resolver ran" + "the variant is neutral, not primary".
    expect(wrapper?.className).toMatch(/border-border/)
    expect(wrapper?.className).toMatch(/bg-background/)
  })

  it("commits inline edit via the nested fieldKey 'button.label'", () => {
    const onEdit = vi.fn()
    render(
      <PageBuilderRenderProvider isEditing onEditField={onEdit}>
        <Render {...defaultProps} />
      </PageBuilderRenderProvider>,
    )
    fireEvent.click(screen.getByTestId(`inline-display-${defaultProps.id}-button.label`))
    const input = screen.getByTestId(`inline-edit-${defaultProps.id}-button.label`) as HTMLInputElement
    fireEvent.change(input, { target: { value: "Save" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onEdit).toHaveBeenCalledWith(defaultProps.id, "button.label", {
      en: "Save",
      ar: defaultProps.button.label.ar,
    })
  })
})

// ─── unchanged: divider + spacer ───────────────────────────────────────────

describe("dividerBlock — Render", () => {
  const { Render, defaultProps } = dividerBlockDefinition

  it("renders a separator", () => {
    const { container } = render(<Render {...defaultProps} />)
    expect(container.querySelector('[role="none"], [data-orientation]')).toBeTruthy()
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })
})

describe("spacerBlock — Render", () => {
  const { Render, defaultProps } = spacerBlockDefinition

  it("renders an aria-hidden div with the correct height class", () => {
    const { container } = render(<Render {...defaultProps} />)
    const div = container.querySelector("div")
    expect(div).toBeTruthy()
    expect(div?.getAttribute("aria-hidden")).toBe("true")
    expect(div?.className).toMatch(/h-(2|4|8)/)
  })

  it("renders nothing when hidden", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })
})
