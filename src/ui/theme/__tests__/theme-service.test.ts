import { describe, it, expect, beforeEach, vi } from "vitest"
import { getSavedTheme, saveTheme, getSystemTheme, applyTheme } from "../theme-service"

vi.mock("@/shared/logger", () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

describe("theme-service localStorage round-trip", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("getSavedTheme returns null when nothing is stored", () => {
    expect(getSavedTheme()).toBeNull()
  })

  it.each(["light", "dark", "system"] as const)("round-trips '%s'", theme => {
    saveTheme(theme)
    expect(getSavedTheme()).toBe(theme)
  })

  it("getSavedTheme returns null for an unknown stored value", () => {
    localStorage.setItem("app-theme", "neon")
    expect(getSavedTheme()).toBeNull()
  })
})

describe("getSystemTheme", () => {
  it("falls back to 'light' when matchMedia matches=false", () => {
    expect(getSystemTheme()).toBe("light")
  })

  it("returns 'dark' when matchMedia reports prefers-color-scheme: dark", () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, media: "" }) as unknown as typeof window.matchMedia
    expect(getSystemTheme()).toBe("dark")
    window.matchMedia = original
  })
})

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark")
  })

  it("adds .dark for dark mode", () => {
    applyTheme("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("removes .dark for light mode", () => {
    document.documentElement.classList.add("dark")
    applyTheme("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
