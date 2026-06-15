/**
 * Automated accessibility tests using axe-core.
 *
 * Scope and intent
 * ----------------
 * Axe in vitest is a *trip-wire*, not a full audit. It catches regressions in
 * the patterns covered by axe's WCAG 2.1 ruleset — missing labels, low colour
 * contrast on plain elements, ARIA misuse, button without name, image without
 * alt text. It does NOT catch:
 *
 *   - Visual issues that need a real browser (icon flips, RTL layout flaws,
 *     focus-ring visibility against the actual theme tokens).
 *   - Keyboard-flow issues (axe doesn't simulate tab order at runtime).
 *   - Screen-reader announcement quality.
 *   - Content-driven contrast issues from data the user types in.
 *
 * Those still require a real browser pass with NVDA/VoiceOver and a manual
 * keyboard-only walkthrough. Documented in docs/a11y-checklist.md.
 *
 * Why these specific primitives:
 *   We test the UI primitives every page composes from — Button, Input,
 *   Label, Alert, Card. If any of these slips an axe rule, every consumer
 *   inherits the violation. Component-specific tests should be added in the
 *   component's own __tests__ folder as the surface area grows.
 */

import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { axe } from "vitest-axe"
import * as axeMatchers from "vitest-axe/matchers"

// vitest-axe ships a global augmentation against the legacy `Vi` namespace,
// but vitest 4 exposes `Assertion` directly from "vitest". Re-augment so
// `expect(...).toHaveNoViolations()` is typed.
declare module "vitest" {
  // Match vitest's own generic param exactly (`<T = any>`) so the augmentation
  // merges into the existing declaration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Assertion<T = any> {
    toHaveNoViolations(): void
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void
  }
}

// Some primitives transitively read the design-system theme via useTheme.
// We don't need the real theme for axe to evaluate the markup — just stub the
// hook so the primitives render without provider scaffolding.
vi.mock("@/ui/theme/ThemeManager", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useTheme: () => ({
      theme: "light",
      settings: {},
      activePreset: "modern-professional",
      isInitialized: true,
      isDirty: false,
      versions: [],
      setTheme: vi.fn(),
      setActivePreset: vi.fn(),
      updateSettings: vi.fn(),
      resetToDefaults: vi.fn(),
      resetToPreset: vi.fn(),
      publishTheme: vi.fn(),
      rollbackToVersion: vi.fn(),
      exportSettings: vi.fn(() => "{}"),
      importSettings: vi.fn(() => true),
      updateComponentStyle: vi.fn(),
      updateComponentClasses: vi.fn(),
      resetComponentStyle: vi.fn(),
      resetAllComponents: vi.fn(),
    }),
  }
})

import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Alert, AlertDescription, AlertTitle } from "@/ui/design-system/primitives/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"

expect.extend(axeMatchers)

describe("a11y: design-system primitives", () => {
  it("Button has no axe violations when given a label", async () => {
    const { container } = render(<Button>Save</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Button (icon-only) requires an aria-label", async () => {
    // Icon-only buttons must declare an accessible name. Without one this
    // test fails — which is the regression we want to catch.
    const { container } = render(
      <Button size="icon" aria-label="Close dialog">
        <span aria-hidden="true">×</span>
      </Button>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Input + Label are wired by htmlFor / id", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </div>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Alert uses semantic role and is announced", async () => {
    const { container } = render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>Your changes were saved.</AlertDescription>
      </Alert>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it("Card with header + content composes cleanly", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Three items in the last hour.</p>
        </CardContent>
      </Card>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
