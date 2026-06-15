/**
 * Rate-limit policy tests for the Task B4 codegen + runtime endpoints.
 *
 * Lives next to `config.test.ts` (the auth-route equivalent) so a future
 * change to either policy is a one-file scope. Two responsibilities:
 *
 *   1. Pin the rule table — label, max, windowMs, predicate. If a policy
 *      number changes (e.g. raising the materialize cap from 10 to 20),
 *      this is the test that has to change with it. That's intentional —
 *      a silent loosening of the cap should never get past code review.
 *
 *   2. Exercise the limiter end-to-end against the real configured caps,
 *      so the spec's "6th codegen request returns 429" promise is locked
 *      down. The limiter is in-process; we re-create it per test so window
 *      state never leaks across cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createInMemoryRateLimiter, type RateLimiter } from "../index"
import { findRateLimit } from "../config"

// ─── Layer 1: rule-table pin ────────────────────────────────────────────────

describe("findRateLimit — codegen + runtime rules (Task B4)", () => {
  it("matches /api/admin/entity-builder/generate to codegen-entity (5/min)", () => {
    const rule = findRateLimit("/api/admin/entity-builder/generate")
    expect(rule?.label).toBe("codegen-entity")
    expect(rule?.max).toBe(5)
    expect(rule?.windowMs).toBe(60_000)
  })

  it("matches /api/admin/widget-builder/generate to codegen-widget (5/min)", () => {
    const rule = findRateLimit("/api/admin/widget-builder/generate")
    expect(rule?.label).toBe("codegen-widget")
    expect(rule?.max).toBe(5)
    expect(rule?.windowMs).toBe(60_000)
  })

  it("matches /api/runtime/materialize/<id> to codegen-materialize (10/min)", () => {
    const rule = findRateLimit("/api/runtime/materialize/customers")
    expect(rule?.label).toBe("codegen-materialize")
    expect(rule?.max).toBe(10)
    expect(rule?.windowMs).toBe(60_000)
  })

  it("matches /api/runtime/data/<id> to runtime-write (30/min)", () => {
    const rule = findRateLimit("/api/runtime/data/customers")
    expect(rule?.label).toBe("runtime-write")
    expect(rule?.max).toBe(30)
    expect(rule?.windowMs).toBe(60_000)
  })

  it("does NOT rate-limit /api/runtime/config (read-heavy, polled)", () => {
    expect(findRateLimit("/api/runtime/config")).toBeNull()
  })

  it("does NOT rate-limit /api/runtime/version (polled every 8s by every browser)", () => {
    expect(findRateLimit("/api/runtime/version")).toBeNull()
  })

  it("does NOT rate-limit unrelated admin endpoints", () => {
    expect(findRateLimit("/api/admin/dashboard-layout/default")).toBeNull()
    // The list endpoint was retired in Part 4 cleanup; assertion stays
    // as a regression guard so any future re-introduction inherits no
    // rate-limit by default.
    expect(findRateLimit("/api/admin/entity-builder")).toBeNull()
  })
})

// ─── Layer 2: end-to-end limiter behaviour against the real caps ────────────

describe("rate limiter — codegen endpoints lock down at the documented cadence", () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = createInMemoryRateLimiter()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-07T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function attempt(path: string, ip = "1.2.3.4") {
    const rule = findRateLimit(path)
    if (!rule) throw new Error(`No rule for ${path}`)
    return limiter.check(`${rule.label}:${ip}`, rule.max, rule.windowMs)
  }

  it("the 6th /api/admin/entity-builder/generate request in a minute returns blocked", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(true)
    }
    expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(false)
  })

  it("the 6th widget-builder generate request also blocks", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await attempt("/api/admin/widget-builder/generate")).allowed).toBe(true)
    }
    expect((await attempt("/api/admin/widget-builder/generate")).allowed).toBe(false)
  })

  it("materialize allows 10 then blocks the 11th", async () => {
    for (let i = 1; i <= 10; i++) {
      expect((await attempt("/api/runtime/materialize/x")).allowed).toBe(true)
    }
    expect((await attempt("/api/runtime/materialize/x")).allowed).toBe(false)
  })

  it("runtime-write allows 30 then blocks the 31st", async () => {
    for (let i = 1; i <= 30; i++) {
      expect((await attempt("/api/runtime/data/customers")).allowed).toBe(true)
    }
    expect((await attempt("/api/runtime/data/customers")).allowed).toBe(false)
  })

  it("limits are per-IP — a different IP gets its own bucket", async () => {
    for (let i = 1; i <= 5; i++) await attempt("/api/admin/entity-builder/generate", "1.1.1.1")
    expect((await attempt("/api/admin/entity-builder/generate", "1.1.1.1")).allowed).toBe(false)
    expect((await attempt("/api/admin/entity-builder/generate", "2.2.2.2")).allowed).toBe(true)
  })

  it("limits are per-rule — entity-generate doesn't consume widget-generate budget", async () => {
    for (let i = 1; i <= 5; i++) await attempt("/api/admin/entity-builder/generate")
    // Entity is exhausted; widget should still have a fresh window.
    expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(false)
    expect((await attempt("/api/admin/widget-builder/generate")).allowed).toBe(true)
  })

  it("limits are per-rule — codegen exhaustion doesn't bleed into runtime-write", async () => {
    for (let i = 1; i <= 5; i++) await attempt("/api/admin/entity-builder/generate")
    expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(false)
    expect((await attempt("/api/runtime/data/x")).allowed).toBe(true)
  })

  it("recovers after the window elapses", async () => {
    for (let i = 1; i <= 5; i++) await attempt("/api/admin/entity-builder/generate")
    expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(false)

    vi.advanceTimersByTime(60_001)

    expect((await attempt("/api/admin/entity-builder/generate")).allowed).toBe(true)
  })

  it("the materialize dryRun + commit pair from the UI fits inside the 10/min budget", async () => {
    // The MaterializeDialog hits /api/runtime/materialize/<id>?dryRun=true
    // when opened, then again without the flag when the admin commits.
    // That's two requests per user-initiated materialise. 10/min therefore
    // supports 5 distinct materialise actions per minute — comfortable
    // for any human pace.
    let attempts = 0
    const path = "/api/runtime/materialize/x"
    while ((await attempt(path)).allowed) attempts += 1
    // The 11th attempt is the one that gets refused, so we got 10 allowed.
    expect(attempts).toBe(10)
  })
})
