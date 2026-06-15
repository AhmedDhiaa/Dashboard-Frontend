/**
 * Pin every cell of the mock-API safeguard truth table.
 *
 *   NODE_ENV       | FLAG  | OVERRIDE       | result
 *   ---------------|-------|----------------|---------------------------
 *   development    | true  | (anything)     | ok: not-production
 *   test           | true  | (anything)     | ok: not-production
 *   undefined      | true  | (anything)     | ok: not-production
 *   production     | false | (anything)     | ok: flag-disabled
 *   production     | true  | exact token    | ok: override-acknowledged
 *   production     | true  | wrong token    | FAIL: production-without-override
 *   production     | true  | undefined      | FAIL: production-without-override
 *
 * The function is pure — every test passes a fresh env-object literal so
 * the suite never mutates `process.env`.
 */

import { describe, expect, it } from "vitest"
import { MOCK_API_FLAG, MOCK_API_OVERRIDE, MOCK_API_OVERRIDE_TOKEN, checkMockApiFlag } from "../mock-api-flag"

describe("checkMockApiFlag — non-production paths always pass", () => {
  it("development + flag set + no override → ok (not-production)", () => {
    const r = checkMockApiFlag({ NODE_ENV: "development", [MOCK_API_FLAG]: "true" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("not-production")
  })

  it("test + flag set → ok (not-production)", () => {
    const r = checkMockApiFlag({ NODE_ENV: "test", [MOCK_API_FLAG]: "true" })
    expect(r.ok).toBe(true)
  })

  it("undefined NODE_ENV + flag set → ok (not-production)", () => {
    const r = checkMockApiFlag({ [MOCK_API_FLAG]: "true" })
    expect(r.ok).toBe(true)
  })
})

describe("checkMockApiFlag — production paths", () => {
  it("flag disabled → ok (flag-disabled)", () => {
    const r = checkMockApiFlag({ NODE_ENV: "production" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("flag-disabled")
  })

  it("flag set to anything other than 'true' → ok (flag-disabled)", () => {
    for (const value of ["1", "yes", "on", "TRUE", "True"]) {
      const r = checkMockApiFlag({ NODE_ENV: "production", [MOCK_API_FLAG]: value })
      expect(r.ok, `value="${value}" should leave mock mode disabled`).toBe(true)
    }
  })

  it("flag=true + override=exact token → ok (override-acknowledged)", () => {
    const r = checkMockApiFlag({
      NODE_ENV: "production",
      [MOCK_API_FLAG]: "true",
      [MOCK_API_OVERRIDE]: MOCK_API_OVERRIDE_TOKEN,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("override-acknowledged")
  })

  it("flag=true + override missing → FAIL", () => {
    const r = checkMockApiFlag({ NODE_ENV: "production", [MOCK_API_FLAG]: "true" })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe("production-without-override")
      expect(r.message).toContain(MOCK_API_FLAG)
      expect(r.message).toContain(MOCK_API_OVERRIDE)
      expect(r.message).toContain(MOCK_API_OVERRIDE_TOKEN)
    }
  })

  it("flag=true + override='true' (wrong token) → FAIL", () => {
    const r = checkMockApiFlag({
      NODE_ENV: "production",
      [MOCK_API_FLAG]: "true",
      [MOCK_API_OVERRIDE]: "true",
    })
    expect(r.ok).toBe(false)
  })

  it("flag=true + override case mismatch → FAIL", () => {
    const r = checkMockApiFlag({
      NODE_ENV: "production",
      [MOCK_API_FLAG]: "true",
      [MOCK_API_OVERRIDE]: MOCK_API_OVERRIDE_TOKEN.toUpperCase(),
    })
    expect(r.ok).toBe(false)
  })
})

describe("checkMockApiFlag — failure message is operator-friendly", () => {
  const fail = checkMockApiFlag({ NODE_ENV: "production", [MOCK_API_FLAG]: "true" })

  it("starts with FATAL so log-aggregators can trigger pages", () => {
    if (fail.ok) throw new Error("expected failure")
    expect(fail.message.startsWith("FATAL:")).toBe(true)
  })

  it("explains the remediation path", () => {
    if (fail.ok) throw new Error("expected failure")
    expect(fail.message).toMatch(/NEXT_PUBLIC_USE_MOCK_API=false.*secret store.*redeploy/i)
  })
})
