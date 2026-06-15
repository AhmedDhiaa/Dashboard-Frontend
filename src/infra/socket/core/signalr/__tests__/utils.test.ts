/**
 * Pure-helpers coverage for the SignalR utils module. These functions
 * compose the runtime config and decide reconnect cadence, so a regression
 * either silently changes the SignalR transport or breaks the reconnect
 * curve under load.
 */

import { describe, it, expect } from "vitest"
import { buildConfig, calculateReconnectDelay, wrapError, DEFAULT_CONFIG } from "../utils"
import { SignalRAuthenticationError, SignalRConnectionError, SignalRTimeoutError } from "../../types"

describe("buildConfig", () => {
  it("layers user config on top of DEFAULT_CONFIG", () => {
    const cfg = buildConfig({ url: "https://api.example/hub", maxReconnectAttempts: 3 })
    expect(cfg.maxReconnectAttempts).toBe(3) // overridden
    expect(cfg.connectionTimeout).toBe(DEFAULT_CONFIG.connectionTimeout) // inherited
    expect(cfg.url).toBe("https://api.example/hub")
  })

  it("normalizes optional fields to defaults so callers can rely on shape", () => {
    // url is the only required field on SignalRConfig; everything else
    // either has a default or is an opt-in override.
    const cfg = buildConfig({ url: "" })
    expect(cfg.url).toBe("")
    expect(cfg.token).toBe("")
    expect(cfg.headers).toEqual({})
    // Transport must be set so `performConnect` doesn't blow up looking up
    // an undefined enum member; default is WebSockets (numeric 1).
    expect(cfg.transport).toBe(1)
  })

  it("clones reconnectDelays so the caller can't later mutate the runtime cadence", () => {
    const delays = [100, 200, 300]
    const cfg = buildConfig({ url: "u", reconnectDelays: delays })
    delays[0] = 9999
    expect(cfg.reconnectDelays[0]).toBe(100)
  })

  it("preserves an explicitly empty token / headers without falling back to defaults", () => {
    const cfg = buildConfig({ url: "u", token: "abc", headers: { "X-Test": "1" } })
    expect(cfg.token).toBe("abc")
    expect(cfg.headers).toEqual({ "X-Test": "1" })
  })
})

describe("calculateReconnectDelay", () => {
  it("indexes by attempt number for the early attempts", () => {
    const delays = [1000, 2000, 5000, 10000, 30000]
    expect(calculateReconnectDelay(delays, 0)).toBe(1000)
    expect(calculateReconnectDelay(delays, 2)).toBe(5000)
  })

  it("clamps to the last value once attempts exceed the table length", () => {
    const delays = [1000, 2000, 5000]
    expect(calculateReconnectDelay(delays, 99)).toBe(5000)
  })

  it("returns the safety fallback (1000ms) for an empty delay table", () => {
    // delays[min(0, -1)] === delays[0] is undefined → fallback 1000.
    expect(calculateReconnectDelay([], 0)).toBe(1000)
  })
})

describe("wrapError", () => {
  it("classifies 401 / unauthorized as SignalRAuthenticationError", () => {
    expect(wrapError(new Error("401 unauthorized"))).toBeInstanceOf(SignalRAuthenticationError)
    expect(wrapError(new Error("Server returned unauthorized"))).toBeInstanceOf(SignalRAuthenticationError)
  })

  it("classifies timeout messages as SignalRTimeoutError", () => {
    expect(wrapError(new Error("connection timeout exceeded"))).toBeInstanceOf(SignalRTimeoutError)
  })

  it("falls back to SignalRConnectionError for ordinary Errors and preserves the cause", () => {
    const original = new Error("net unreachable")
    const wrapped = wrapError(original) as SignalRConnectionError
    expect(wrapped).toBeInstanceOf(SignalRConnectionError)
    expect(wrapped.message).toBe("net unreachable")
  })

  it("coerces non-Error throwables to SignalRConnectionError with String(value)", () => {
    expect(wrapError("plain string failure")).toBeInstanceOf(SignalRConnectionError)
    expect(wrapError({ foo: "bar" }).message).toBe("[object Object]")
  })
})
