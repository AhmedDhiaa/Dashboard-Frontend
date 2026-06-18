import { act, render, type RenderResult } from "@testing-library/react"
import type { ReactElement } from "react"

/**
 * Render `ui` and flush any `requestAnimationFrame`-scheduled state updates
 * *inside* `act(...)`.
 *
 * The app `ThemeProvider` (which the a11y suites wrap their subjects in) reads
 * persisted settings in a rAF callback and flips `isInitialized`, which then
 * triggers the variable-applier effect (a second rAF). Those updates land after
 * `render()` returns, so a plain `render(...)` followed by `await axe(container)`
 * prints a stream of "An update to ThemeProviderInner was not wrapped in
 * act(...)" warnings.
 *
 * Awaiting two nested frames within an async `act` block captures the whole
 * init → apply chain, leaving the test output clean. The settled DOM is
 * identical to the post-mount state, so axe assertions are unaffected.
 *
 * This helper is layer-neutral — it imports no provider, so it stays inside the
 * `shared` layer. Callers pass the fully-wrapped element, e.g.
 * `renderAndSettle(<ThemeProvider>{ui}</ThemeProvider>)`.
 */
export async function renderAndSettle(ui: ReactElement): Promise<RenderResult> {
  let result!: RenderResult
  await act(async () => {
    result = render(ui)
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  return result
}
