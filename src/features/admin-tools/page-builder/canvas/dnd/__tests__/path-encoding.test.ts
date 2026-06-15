import { describe, it, expect } from "vitest"
import { encodePath, decodePath } from "../path-encoding"
import type { BlockPath } from "../../tree/types"

describe("encodePath / decodePath", () => {
  it("round-trips an empty path", () => {
    expect(encodePath([])).toBe("")
    expect(decodePath("")).toEqual([])
  })

  it("round-trips a root-only path", () => {
    const path: BlockPath = [{ kind: "root", index: 2 }]
    expect(decodePath(encodePath(path))).toEqual(path)
    expect(encodePath(path)).toBe("root:2")
  })

  it("round-trips a 3-level nested path", () => {
    const path: BlockPath = [
      { kind: "root", index: 0 },
      { kind: "blocks", index: 1 },
      { kind: "tab", tabId: "tab-login", index: 2 },
    ]
    expect(decodePath(encodePath(path))).toEqual(path)
    expect(encodePath(path)).toBe("root:0|blocks:1|tab:tab-login:2")
  })

  it("round-trips an accordion item path", () => {
    const path: BlockPath = [
      { kind: "root", index: 0 },
      { kind: "item", itemId: "item-pricing", index: 3 },
    ]
    expect(decodePath(encodePath(path))).toEqual(path)
    expect(encodePath(path)).toBe("root:0|item:item-pricing:3")
  })

  it("round-trips an action-blocks path", () => {
    const path: BlockPath = [
      { kind: "root", index: 1 },
      { kind: "action-blocks", index: 0 },
    ]
    expect(decodePath(encodePath(path))).toEqual(path)
    expect(encodePath(path)).toBe("root:1|action-blocks:0")
  })

  it("preserves dashes in tab/item ids (kebab-case is allowed)", () => {
    const path: BlockPath = [
      { kind: "root", index: 0 },
      { kind: "tab", tabId: "tab-multi-word-id", index: 0 },
    ]
    expect(decodePath(encodePath(path))).toEqual(path)
  })

  it("returns null for malformed input — unknown kind", () => {
    expect(decodePath("ghost:0")).toBeNull()
  })

  it("returns null for malformed input — non-numeric index", () => {
    expect(decodePath("root:abc")).toBeNull()
    expect(decodePath("tab:tab-a:nope")).toBeNull()
  })

  it("returns null for malformed input — missing fields", () => {
    expect(decodePath("tab:tab-a")).toBeNull() // missing index
    expect(decodePath("root")).toBeNull() // missing index
    expect(decodePath("blocks:")).toBeNull() // empty index
  })

  it("returns null for malformed input — partial decode failure aborts the whole path", () => {
    expect(decodePath("root:0|garbage")).toBeNull()
  })
})
