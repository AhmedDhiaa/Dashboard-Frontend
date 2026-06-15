/**
 * Performance smoke tests — assert that tree operations stay within the
 * targets stated in TASK 2A.1 even on synthetic worst-case trees.
 *
 * Trees are built from the test fixtures so the shape exactly matches
 * what the canvas would feed in. Numbers are conservative — local runs
 * generally come in well under the cap, but CI machines vary, hence the
 * margin.
 */

import { describe, it, expect } from "vitest"
import { findBlockById, getBlockAt, moveBlock, insertBlockAt, removeBlockAt } from "../operations"
import { walkBlocks } from "../walker"
import type { PageSchema } from "../../../schema/page-schema"
import type { BlockSchema } from "../../../schema/block-schema"
import { heading, card, pageWith } from "./fixtures"
import { asBlockNode } from "../types"

/** Build a flat-then-deep tree of `total` heading blocks for stress runs. */
function buildLargeTree(total: number, branchFactor = 5): PageSchema {
  const leafs: BlockSchema[] = []
  for (let i = 0; i < total; i++) leafs.push(heading(`h-${i}`))
  // Pack into nested cards of `branchFactor` each — gives a tree with
  // depth ~= log_branchFactor(total).
  let level = leafs
  while (level.length > branchFactor) {
    const next: BlockSchema[] = []
    for (let i = 0; i < level.length; i += branchFactor) {
      next.push(card(`c-${i}-${level.length}`, level.slice(i, i + branchFactor)))
    }
    level = next
  }
  return pageWith(level)
}

describe("performance — 100 blocks", () => {
  const schema = buildLargeTree(100)

  it("walkBlocks visits every block in <5ms", () => {
    const start = performance.now()
    let count = 0
    walkBlocks(schema, () => {
      count += 1
    })
    const elapsed = performance.now() - start
    expect(count).toBeGreaterThanOrEqual(100)
    expect(elapsed).toBeLessThan(5)
  })

  it("findBlockById on 100-block tree completes in <5ms", () => {
    const start = performance.now()
    const result = findBlockById(schema, "h-99")
    const elapsed = performance.now() - start
    expect(result).not.toBeNull()
    expect(elapsed).toBeLessThan(5)
  })

  it("insertBlockAt at root completes in <5ms", () => {
    const start = performance.now()
    const next = insertBlockAt(schema, null, { kind: "root", index: 0 }, 0, heading("h-new"))
    const elapsed = performance.now() - start
    expect(asBlockNode(next.blocks[0]!).id).toBe("h-new")
    expect(elapsed).toBeLessThan(5)
  })

  it("removeBlockAt at root completes in <5ms", () => {
    const start = performance.now()
    const next = removeBlockAt(schema, [{ kind: "root", index: 0 }])
    const elapsed = performance.now() - start
    expect(next.blocks.length).toBeLessThan(schema.blocks.length)
    expect(elapsed).toBeLessThan(5)
  })
})

describe("performance — 1000 blocks", () => {
  const schema = buildLargeTree(1000)

  it("findBlockById finds a leaf in <10ms", () => {
    const start = performance.now()
    const result = findBlockById(schema, "h-999")
    const elapsed = performance.now() - start
    expect(result).not.toBeNull()
    expect(elapsed).toBeLessThan(10)
  })

  it("getBlockAt resolves a known path in <2ms", () => {
    // Locate a path via findBlockById once so the test stays robust to the
    // synthetic tree's shape; only the second lookup is timed.
    const result = findBlockById(schema, "h-500")
    expect(result).not.toBeNull()
    const start = performance.now()
    const got = getBlockAt(schema, result!.path)
    const elapsed = performance.now() - start
    expect(asBlockNode(got!).id).toBe("h-500")
    expect(elapsed).toBeLessThan(2)
  })
})

describe("performance — 500 blocks moveBlock", () => {
  const schema = buildLargeTree(500)

  it("moveBlock from one path to another completes in <20ms", () => {
    const fromResult = findBlockById(schema, "h-0")
    const toResult = findBlockById(schema, "h-499")
    expect(fromResult).not.toBeNull()
    expect(toResult).not.toBeNull()
    // Move "h-0" to live next to its sibling at the destination's parent.
    const toParentPath = toResult!.path.slice(0, -1)
    const toSlot = toResult!.path[toResult!.path.length - 1]!
    const start = performance.now()
    const next = moveBlock(schema, fromResult!.path, toParentPath, toSlot, 0)
    const elapsed = performance.now() - start
    expect(next).not.toBe(schema)
    expect(elapsed).toBeLessThan(20)
  })
})
