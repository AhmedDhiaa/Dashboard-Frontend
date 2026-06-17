/**
 * Performance smoke tests — assert that tree operations stay within their
 * algorithmic targets (linear scans / path resolves) even on synthetic
 * worst-case trees, built from the canvas's own fixtures.
 *
 * These wall-clock caps are deliberately **catastrophe detectors, not precise
 * budgets**. They run inside a heavily-parallel jsdom worker pool, so absolute
 * timing is at the mercy of scheduler contention and GC pauses — a tight
 * single-digit-ms cap flakes on a loaded CI runner (observed: a 1000-node O(n)
 * scan that's sub-millisecond when isolated spiking to ~70ms under full-suite
 * load). The caps below carry ~10x headroom over the loaded worst case, so they
 * still trip on a genuine blowup (an accidental O(n²)/O(n³) or sync I/O on these
 * trees lands far above the cap) while surviving jitter. For exact complexity
 * guarantees, assert operation counts — not time.
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

  it("walkBlocks visits every block well under the cap (<50ms)", () => {
    const start = performance.now()
    let count = 0
    walkBlocks(schema, () => {
      count += 1
    })
    const elapsed = performance.now() - start
    expect(count).toBeGreaterThanOrEqual(100)
    expect(elapsed).toBeLessThan(50)
  })

  it("findBlockById on 100-block tree completes well under the cap (<50ms)", () => {
    const start = performance.now()
    const result = findBlockById(schema, "h-99")
    const elapsed = performance.now() - start
    expect(result).not.toBeNull()
    expect(elapsed).toBeLessThan(50)
  })

  it("insertBlockAt at root completes well under the cap (<50ms)", () => {
    const start = performance.now()
    const next = insertBlockAt(schema, null, { kind: "root", index: 0 }, 0, heading("h-new"))
    const elapsed = performance.now() - start
    expect(asBlockNode(next.blocks[0]!).id).toBe("h-new")
    expect(elapsed).toBeLessThan(50)
  })

  it("removeBlockAt at root completes well under the cap (<50ms)", () => {
    const start = performance.now()
    const next = removeBlockAt(schema, [{ kind: "root", index: 0 }])
    const elapsed = performance.now() - start
    expect(next.blocks.length).toBeLessThan(schema.blocks.length)
    expect(elapsed).toBeLessThan(50)
  })
})

describe("performance — 1000 blocks", () => {
  const schema = buildLargeTree(1000)

  it("findBlockById finds a leaf well under the cap (<100ms)", () => {
    const start = performance.now()
    const result = findBlockById(schema, "h-999")
    const elapsed = performance.now() - start
    expect(result).not.toBeNull()
    expect(elapsed).toBeLessThan(100)
  })

  it("getBlockAt resolves a known path well under the cap (<25ms)", () => {
    // Locate a path via findBlockById once so the test stays robust to the
    // synthetic tree's shape; only the second lookup is timed.
    const result = findBlockById(schema, "h-500")
    expect(result).not.toBeNull()
    const start = performance.now()
    const got = getBlockAt(schema, result!.path)
    const elapsed = performance.now() - start
    expect(asBlockNode(got!).id).toBe("h-500")
    expect(elapsed).toBeLessThan(25)
  })
})

describe("performance — 500 blocks moveBlock", () => {
  const schema = buildLargeTree(500)

  it("moveBlock from one path to another completes well under the cap (<150ms)", () => {
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
    expect(elapsed).toBeLessThan(150)
  })
})
