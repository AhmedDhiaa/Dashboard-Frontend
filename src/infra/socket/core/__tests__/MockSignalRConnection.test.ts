import { describe, it, expect, vi, afterEach } from "vitest"
import { MockSignalRConnection } from "../MockSignalRConnection"
import type { DriverTrackingDto } from "../types"

const config = {
  url: "",
  autoReconnect: true,
  maxReconnectAttempts: 1,
  reconnectDelays: [1000],
  connectionTimeout: 1000,
}

afterEach(() => {
  vi.useRealTimers()
})

describe("MockSignalRConnection", () => {
  it("connects instantly without a network and reports connected state", async () => {
    const c = new MockSignalRConnection(config)
    expect(c.isConnected()).toBe(false)

    await c.connect()
    expect(c.isConnected()).toBe(true)
    expect(c.getState()).toBe("connected")

    await c.disconnect()
    expect(c.isConnected()).toBe(false)
    expect(c.getState()).toBe("disconnected")
  })

  it("resolves invoke()/send() as no-ops so group joins don't throw in mock mode", async () => {
    const c = new MockSignalRConnection(config)
    await c.connect()
    await expect(c.invoke("JoinDriverTrackingGroup")).resolves.toBeUndefined()
    await expect(c.send("anything")).resolves.toBeUndefined()
    await c.disconnect()
  })

  it("emits synthetic ReceiveDriverTracking frames to subscribers on each tick", async () => {
    vi.useFakeTimers()
    const c = new MockSignalRConnection(config)
    await c.connect()

    const received: DriverTrackingDto[] = []
    const sub = c.on<DriverTrackingDto>("ReceiveDriverTracking", d => received.push(d))

    vi.advanceTimersByTime(1_600) // one ~1.5s tick
    expect(received.length).toBeGreaterThan(0)

    const dto = received[0]!
    expect(dto.driverId).toBeTruthy()
    expect(dto.locationPoint).toBeTruthy()
    expect(typeof dto.locationPoint!.latitude).toBe("number")
    expect(typeof dto.locationPoint!.longitude).toBe("number")

    // Positions advance frame-to-frame (the markers visibly move).
    const firstLat = dto.locationPoint!.latitude
    received.length = 0
    vi.advanceTimersByTime(1_600)
    const sameDriver = received.find(d => d.driverId === dto.driverId)
    expect(sameDriver).toBeTruthy()
    expect(sameDriver!.locationPoint!.latitude).not.toBe(firstLat)

    sub.unsubscribe()
    await c.disconnect()
  })

  it("does no work when nobody is subscribed (cheap idle tick)", async () => {
    vi.useFakeTimers()
    const c = new MockSignalRConnection(config)
    await c.connect()

    // No subscribers → ticks must not throw and must not accumulate anything.
    expect(() => vi.advanceTimersByTime(5_000)).not.toThrow()

    const received: DriverTrackingDto[] = []
    const sub = c.on<DriverTrackingDto>("ReceiveDriverTracking", d => received.push(d))
    vi.advanceTimersByTime(1_600)
    expect(received.length).toBeGreaterThan(0)

    // After unsubscribe, ticks stop delivering.
    sub.unsubscribe()
    received.length = 0
    vi.advanceTimersByTime(3_000)
    expect(received.length).toBe(0)

    await c.disconnect()
  })

  it("stops emitting after disconnect", async () => {
    vi.useFakeTimers()
    const c = new MockSignalRConnection(config)
    await c.connect()
    const received: DriverTrackingDto[] = []
    c.on<DriverTrackingDto>("ReceiveDriverTracking", d => received.push(d))

    await c.disconnect()
    received.length = 0
    vi.advanceTimersByTime(5_000)
    expect(received.length).toBe(0)
  })
})
