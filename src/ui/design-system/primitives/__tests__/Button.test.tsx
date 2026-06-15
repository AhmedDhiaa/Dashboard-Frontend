import { render } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { describe, it, expect, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { Button } from "../button"
import { ThemeProvider } from "@/ui/theme/ThemeManager"

// Button consumes theme context via useTheme(); wrap renders in the provider.
function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe("Button", () => {
  it("renders children correctly", () => {
    renderWithTheme(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument()
  })

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole("button"))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("can be disabled", () => {
    renderWithTheme(<Button disabled>Disabled</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("applies variant classes correctly", () => {
    const { rerender } = renderWithTheme(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-destructive")

    rerender(
      <ThemeProvider>
        <Button variant="outline">Outline</Button>
      </ThemeProvider>,
    )
    expect(screen.getByRole("button")).toHaveClass("border")
  })

  // Regression: with asChild, the Button used to wrap children with ripple/loader
  // siblings, which made Radix Slot's React.Children.only throw at runtime.
  // The single-child render path must render the consumer's element directly.
  it("asChild forwards classes onto the child element without throwing", () => {
    renderWithTheme(
      <Button asChild variant="primary">
        <a href="https://example.com/go">Go</a>
      </Button>,
    )

    const link = screen.getByRole("link", { name: /go/i })
    expect(link).toHaveAttribute("href", "https://example.com/go")
    expect(link).toHaveClass("bg-primary")
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("asChild fires onClick on the child element", async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(
      <Button asChild onClick={handleClick}>
        <a href="#">Click link</a>
      </Button>,
    )

    await user.click(screen.getByRole("link"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
