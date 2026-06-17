/**
 * Silence recharts' inherent "width(-1) and height(-1)" dev warning.
 *
 * `<ResponsiveContainer>` initialises its size state to -1 and logs this
 * warning on its very first render frame — before its own ResizeObserver
 * measures the parent — once per chart, regardless of whether the parent has
 * a real box. Chart bodies are dynamic-imported and only mount once measured,
 * so there's no repeated re-render thrash, but this single inherent warning per
 * chart still floods the console on a chart-heavy dashboard (~28 lines).
 *
 * This drops ONLY that exact message; every other console.warn passes through
 * untouched. Browser-only and idempotent (guarded by a window flag), so it is
 * safe to import from multiple entry points.
 */

if (typeof window !== "undefined") {
  const w = window as unknown as { __rechartsResizeWarnPatched?: boolean }
  if (!w.__rechartsResizeWarnPatched) {
    w.__rechartsResizeWarnPatched = true
    const original = console.warn.bind(console)
    console.warn = (...args: unknown[]): void => {
      const first = args[0]
      if (typeof first === "string" && first.includes("width(-1) and height(-1)")) return
      original(...args)
    }
  }
}

export {}
