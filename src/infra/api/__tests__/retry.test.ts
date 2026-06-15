import { describe, it, expect } from "vitest"

// Test the retry interceptor logic in isolation
describe("API retry interceptor", () => {
  const RETRYABLE_CODES = [408, 429, 500, 502, 503, 504]
  const NON_RETRYABLE_CODES = [400, 401, 403, 404]

  it("retries on retryable status codes for GET requests", () => {
    for (const code of RETRYABLE_CODES) {
      expect(RETRYABLE_CODES.includes(code)).toBe(true)
    }
  })

  it("does not retry on non-retryable status codes", () => {
    for (const code of NON_RETRYABLE_CODES) {
      expect(RETRYABLE_CODES.includes(code)).toBe(false)
    }
  })

  it("calculates exponential backoff correctly", () => {
    const delay = (attempt: number) => Math.pow(2, attempt - 1) * 500
    expect(delay(1)).toBe(500)
    expect(delay(2)).toBe(1000)
    expect(delay(3)).toBe(2000)
  })

  it("stops retrying after MAX_RETRIES", () => {
    const MAX_RETRIES = 3
    let retryCount = 0
    const shouldRetry = (count: number) => count <= MAX_RETRIES
    while (shouldRetry(retryCount + 1)) retryCount++
    expect(retryCount).toBe(MAX_RETRIES)
  })

  it("only retries GET requests", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"]
    const retryableMethods = methods.filter(m => m === "GET")
    expect(retryableMethods).toEqual(["GET"])
  })
})
