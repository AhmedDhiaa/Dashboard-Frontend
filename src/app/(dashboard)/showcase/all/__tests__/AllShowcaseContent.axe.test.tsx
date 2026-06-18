/**
 * Axe accessibility smoke test for the AllShowcaseContent mega-page.
 *
 * Each Section is dynamically imported inside AllShowcaseContent (via
 * next/dynamic with ssr:false), so the initial mount renders only the
 * sticky-nav scaffold + the Skeleton fallbacks for each Section. axe is
 * run against that shell.
 *
 * Why not await every Section
 * ---------------------------
 * Mounting every Section synchronously would require all of recharts,
 * react-easy-crop, cmdk, react-dropzone, react-day-picker, and the form
 * stack inside jsdom — slow and brittle. The per-primitive axe coverage
 * already lives in `src/ui/design-system/primitives/__tests__/axe.test.tsx`;
 * this file's job is to verify the mega-page shell itself has zero
 * violations (heading hierarchy, landmarks, aria-labelledby wiring on
 * each section).
 */

import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"

import { ThemeProvider } from "@/ui/theme/ThemeManager"
import { renderAndSettle } from "@/shared/test-utils/axe-render"
import { AllShowcaseContent } from "../AllShowcaseContent"

// Next.js IntersectionObserver isn't available in jsdom — the StickyNav
// hook references it during effect. Stub a no-op so the render does not
// throw before axe even sees the DOM.
beforeAll(() => {
  if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
    class IO {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = ""
      thresholds: number[] = []
    }
    ;(window as unknown as { IntersectionObserver: typeof IO }).IntersectionObserver = IO
  }
})

const AXE_OPTIONS = {
  rules: {
    // jsdom can't run our Tailwind CSS pipeline; color-contrast would
    // report against unstyled defaults. Disabled here for the same
    // reason as the per-primitive axe suite.
    "color-contrast": { enabled: false },
  },
}

describe("AllShowcaseContent — axe", () => {
  it("renders the mega-page shell with zero axe violations", async () => {
    const { container } = await renderAndSettle(
      <ThemeProvider>
        <AllShowcaseContent />
      </ThemeProvider>,
    )
    const results = await axe(container, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })
})
