/**
 * Pin every cell of the safeguard truth table.
 *
 *   NODE_ENV       | FLAG  | OVERRIDE       | result
 *   ---------------|-------|----------------|---------------------------
 *   development    | true  | (anything)     | ok: not-production
 *   production     | (?)   | (?)            | dispatch on flag/override
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
import {
  RUNTIME_CODEGEN_FLAG,
  RUNTIME_CODEGEN_OVERRIDE,
  RUNTIME_CODEGEN_OVERRIDE_TOKEN,
  checkRuntimeCodegenFlag,
} from "../runtime-codegen-flag"

describe("checkRuntimeCodegenFlag — non-production paths always pass", () => {
  it("development + flag set + no override → ok (not-production)", () => {
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "development",
      [RUNTIME_CODEGEN_FLAG]: "true",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("not-production")
  })

  it("test + flag set → ok (not-production)", () => {
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "test",
      [RUNTIME_CODEGEN_FLAG]: "true",
    })
    expect(r.ok).toBe(true)
  })

  it("undefined NODE_ENV + flag set → ok (not-production)", () => {
    // NODE_ENV is conventionally undefined in some local-script contexts.
    // The safeguard only fires on the literal "production" value.
    const r = checkRuntimeCodegenFlag({ [RUNTIME_CODEGEN_FLAG]: "true" })
    expect(r.ok).toBe(true)
  })
})

describe("checkRuntimeCodegenFlag — production paths", () => {
  it("flag disabled → ok (flag-disabled)", () => {
    const r = checkRuntimeCodegenFlag({ NODE_ENV: "production" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("flag-disabled")
  })

  it("flag set to anything other than 'true' → ok (flag-disabled)", () => {
    // The instrumentation gate is strict-equality "true". Truthy strings
    // like "1" / "yes" / "on" must NOT enable codegen, otherwise an env
    // template change would silently arm the flag.
    for (const value of ["1", "yes", "on", "TRUE", "True"]) {
      const r = checkRuntimeCodegenFlag({
        NODE_ENV: "production",
        [RUNTIME_CODEGEN_FLAG]: value,
      })
      expect(r.ok, `value="${value}" should leave codegen disabled`).toBe(true)
    }
  })

  it("flag=true + override=exact token → ok (override-acknowledged)", () => {
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
      [RUNTIME_CODEGEN_OVERRIDE]: RUNTIME_CODEGEN_OVERRIDE_TOKEN,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("override-acknowledged")
  })

  it("flag=true + override missing → FAIL", () => {
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe("production-without-override")
      expect(r.message).toContain(RUNTIME_CODEGEN_FLAG)
      expect(r.message).toContain(RUNTIME_CODEGEN_OVERRIDE)
      expect(r.message).toContain(RUNTIME_CODEGEN_OVERRIDE_TOKEN)
    }
  })

  it("flag=true + override='true' (wrong token) → FAIL", () => {
    // Common mistake: assume the override is a normal boolean. The whole
    // point of a verbose token is to refuse this.
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
      [RUNTIME_CODEGEN_OVERRIDE]: "true",
    })
    expect(r.ok).toBe(false)
  })

  it("flag=true + override='yes' → FAIL", () => {
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
      [RUNTIME_CODEGEN_OVERRIDE]: "yes",
    })
    expect(r.ok).toBe(false)
  })

  it("flag=true + override='I-Understand-The-Risks' (case mismatch) → FAIL", () => {
    // The token comparison is case-sensitive — pin it so a future "let's
    // be lenient with casing" change has to update the test deliberately.
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
      [RUNTIME_CODEGEN_OVERRIDE]: "I-Understand-The-Risks",
    })
    expect(r.ok).toBe(false)
  })

  it("flag=true + override with leading whitespace → FAIL", () => {
    // The safeguard does not trim — env-var leading-whitespace is unusual
    // and treating it as equivalent to the bare token would defeat the
    // contract.
    const r = checkRuntimeCodegenFlag({
      NODE_ENV: "production",
      [RUNTIME_CODEGEN_FLAG]: "true",
      [RUNTIME_CODEGEN_OVERRIDE]: ` ${RUNTIME_CODEGEN_OVERRIDE_TOKEN}`,
    })
    expect(r.ok).toBe(false)
  })
})

describe("checkRuntimeCodegenFlag — failure message is operator-friendly", () => {
  const fail = checkRuntimeCodegenFlag({
    NODE_ENV: "production",
    [RUNTIME_CODEGEN_FLAG]: "true",
  })

  it("starts with FATAL so log-aggregators can trigger pages", () => {
    if (fail.ok) throw new Error("expected failure")
    expect(fail.message.startsWith("FATAL:")).toBe(true)
  })

  it("explains the remediation path", () => {
    if (fail.ok) throw new Error("expected failure")
    expect(fail.message).toMatch(/unset the flag.*secret store.*redeploy/i)
  })
})
