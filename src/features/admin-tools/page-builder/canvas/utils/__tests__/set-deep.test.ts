import { describe, it, expect } from "vitest"
import { setDeep } from "../set-deep"

describe("setDeep", () => {
  it("sets a top-level key", () => {
    expect(setDeep({ a: 1, b: 2 }, "a", 99)).toEqual({ a: 99, b: 2 })
  })

  it("sets a nested object path", () => {
    expect(setDeep({ a: { b: 1, c: 2 } }, "a.b", 99)).toEqual({ a: { b: 99, c: 2 } })
  })

  it("sets an array index via dot-path", () => {
    expect(setDeep({ x: [1, 2, 3] }, "x.1", 99)).toEqual({ x: [1, 99, 3] })
  })

  it("sets a nested LocalizedString inside an array element", () => {
    const input = { tabs: [{ id: "t1", label: { en: "X", ar: "س" } }] }
    const next = setDeep(input, "tabs.0.label", { en: "Y", ar: "ص" })
    expect(next).toEqual({ tabs: [{ id: "t1", label: { en: "Y", ar: "ص" } }] })
  })

  it("creates missing intermediate objects", () => {
    expect(setDeep({} as Record<string, unknown>, "a.b.c", 1)).toEqual({ a: { b: { c: 1 } } })
  })

  it("creates missing intermediate arrays when next segment is numeric", () => {
    expect(setDeep({} as Record<string, unknown>, "items.0.title", "hello")).toEqual({
      items: [{ title: "hello" }],
    })
  })

  it("does not mutate the original input", () => {
    const original = { a: { b: 1 } }
    const next = setDeep(original, "a.b", 99)
    expect(original).toEqual({ a: { b: 1 } })
    expect(next).not.toBe(original)
  })

  it("preserves structural sharing for untouched branches", () => {
    const sibling = { unchanged: true }
    const original = { a: { b: 1 }, sibling }
    const next = setDeep(original, "a.b", 99)
    // The `sibling` branch was never touched — same reference.
    expect((next as typeof original).sibling).toBe(sibling)
    // The touched branch `a` is a new reference.
    expect((next as typeof original).a).not.toBe(original.a)
  })

  it("accepts a pre-split array path", () => {
    expect(setDeep({ a: { b: 1 } }, ["a", "b"], 7)).toEqual({ a: { b: 7 } })
  })
})
