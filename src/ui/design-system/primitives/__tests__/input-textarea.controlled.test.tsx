/**
 * Controlled vs. uncontrolled contract for the Input + Textarea primitives.
 *
 * Regression guard for a real bug: both primitives used to coerce
 * `props.value` (null/undefined → "") and pass it to the native element
 * *unconditionally*. That turned every UNCONTROLLED usage
 * (`<Input defaultValue="…" />`, a ref, or a prop-spread that omits `value`)
 * into a controlled `value=""` with no `onChange` — which React renders as a
 * read-only field and flags with:
 *
 *   "You provided a `value` prop to a form field without an `onChange`
 *    handler. This will render a read-only field."
 *
 * The fix: only inject `value` when the caller actually controls the field
 * (`"value" in props`). These tests pin both halves of that contract so the
 * coercion can't silently come back.
 */

import { render, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"

import { ThemeProvider } from "@/ui/theme/ThemeManager"
import { Input } from "../input"
import { Textarea } from "../textarea"

// The exact React DEV warning the bug produced. Matching on the stable part
// of the string keeps the assertion robust across React minor versions.
const VALUE_WITHOUT_ONCHANGE = /provided a `?value`? prop to a form field without an `?onChange`? handler/i

function withTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

/** Spy on console.error and return the captured warning strings. */
function captureConsoleError() {
  const calls: string[] = []
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    calls.push(args.map(a => (typeof a === "string" ? a : String(a))).join(" "))
  })
  return { calls, spy }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Input — controlled/uncontrolled contract", () => {
  it("stays uncontrolled with defaultValue (no forced value, no warning)", () => {
    const { calls } = captureConsoleError()
    const { getByRole } = withTheme(<Input defaultValue="john@example.com" />)

    const input = getByRole("textbox") as HTMLInputElement
    // The old bug forced value="" → the field would read back as empty.
    expect(input.value).toBe("john@example.com")
    expect(calls.some(m => VALUE_WITHOUT_ONCHANGE.test(m))).toBe(false)
  })

  it("an uncontrolled input remains editable", () => {
    const { getByRole } = withTheme(<Input defaultValue="start" />)
    const input = getByRole("textbox") as HTMLInputElement

    fireEvent.change(input, { target: { value: "typed by the user" } })
    // With the old forced value="" React would snap this back to "".
    expect(input.value).toBe("typed by the user")
  })

  it("normalizes a controlled null value to an empty string", () => {
    const { calls } = captureConsoleError()
    // `value={null}` is the controlled-but-empty case the coercion existed
    // for: it must render "" without flipping to uncontrolled.
    const { getByRole } = withTheme(<Input value={null as unknown as string} onChange={() => {}} />)

    const input = getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("")
    expect(calls.some(m => /uncontrolled|without an `?onChange`?/i.test(m))).toBe(false)
  })

  it("fires onChange for a controlled input", () => {
    const onChange = vi.fn()
    const { getByRole } = withTheme(<Input value="abc" onChange={onChange} />)

    fireEvent.change(getByRole("textbox"), { target: { value: "abcd" } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe("Textarea — controlled/uncontrolled contract", () => {
  it("stays uncontrolled with defaultValue (no forced value, no warning)", () => {
    const { calls } = captureConsoleError()
    const { getByRole } = withTheme(<Textarea defaultValue="draft body text" />)

    const textarea = getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.value).toBe("draft body text")
    expect(calls.some(m => VALUE_WITHOUT_ONCHANGE.test(m))).toBe(false)
  })

  it("an uncontrolled textarea remains editable", () => {
    const { getByRole } = withTheme(<Textarea defaultValue="start" />)
    const textarea = getByRole("textbox") as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: "the user typed this" } })
    expect(textarea.value).toBe("the user typed this")
  })

  it("normalizes a controlled null value to an empty string", () => {
    const { getByRole } = withTheme(<Textarea value={null as unknown as string} onChange={() => {}} />)
    expect((getByRole("textbox") as HTMLTextAreaElement).value).toBe("")
  })

  it("fires onChange for a controlled textarea", () => {
    const onChange = vi.fn()
    const { getByRole } = withTheme(<Textarea value="abc" onChange={onChange} />)

    fireEvent.change(getByRole("textbox"), { target: { value: "abcd" } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
