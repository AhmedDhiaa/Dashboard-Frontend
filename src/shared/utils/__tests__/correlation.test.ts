import { describe, it, expect } from "vitest"
import { generateCorrelationId } from "../correlation"

describe("generateCorrelationId", () => {
  it("returns a 16-character lowercase hex string", () => {
    const id = generateCorrelationId()
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it("returns unique IDs across many calls", () => {
    // Birthday-paradox bound: with 64 bits of entropy, the probability of a
    // collision in 1000 IDs is ~3e-14. Effectively never.
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateCorrelationId())
    }
    expect(ids.size).toBe(1000)
  })
})
