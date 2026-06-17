/**
 * Mock SignalR connection for standalone mock mode (NEXT_PUBLIC_USE_MOCK_API).
 *
 * There is no SignalR hub to reach when the app runs on seeded data, so the
 * realtime surfaces (live driver tracking) would otherwise be dead. This
 * subclass fakes a connected hub and emits synthetic `ReceiveDriverTracking`
 * frames through the EXACT same `eventHandlers` dispatch path a real hub uses
 * — so `useDriverTracking` (and any future tracking UI) works unchanged,
 * with zero mock-awareness in the hooks or consumers.
 *
 * The driver simulator only does work while something is actually subscribed
 * to `ReceiveDriverTracking` (i.e. the tracking page is mounted); otherwise the
 * 1.5s tick is a cheap Map lookup. Swapped in for the real connection by
 * `socket.ts` when `IS_MOCK`.
 */

import { logger } from "@/shared/logger"
import { SignalRConnection } from "./SignalRConnection"
import { setConnectionState } from "./signalr/stateOps"
import type { SignalRInternal } from "./signalr/internal"
import type { DriverTrackingDto } from "./types"

const DRIVER_TRACKING_EVENT = "receivedrivertracking" // lower-cased key, matches subscribeEvent
const TICK_MS = 1_500

/** Service area the simulated fleet roams — central Baghdad. */
const CITY_CENTER = { lat: 33.3152, lng: 44.3661 }
const ROAM_RADIUS_DEG = 0.06 // ~6–7 km box

interface SimDriver {
  driverId: string
  code: string
  name: string
  lat: number
  lng: number
  heading: number // degrees, 0 = north
  speed: number // km/h, for display
  status: "available" | "busy" | "offline"
}

/** Seeded starting fleet — fixed ids so markers persist across ticks. */
function seedDrivers(): SimDriver[] {
  const names = ["Ahmed Hassan", "Sara Kareem", "Omar Ali", "Layla Mahmoud", "Yusuf Saleh", "Noor Abbas"]
  return names.map((name, i) => {
    const angle = (i / names.length) * Math.PI * 2
    return {
      driverId: `drv-${i + 1}`,
      code: `EMP-${String(i + 1).padStart(4, "0")}`,
      name,
      lat: CITY_CENTER.lat + Math.cos(angle) * ROAM_RADIUS_DEG * 0.5,
      lng: CITY_CENTER.lng + Math.sin(angle) * ROAM_RADIUS_DEG * 0.5,
      heading: Math.floor(Math.random() * 360),
      speed: 25 + Math.floor(Math.random() * 35),
      status: i % 4 === 0 ? "available" : "busy",
    }
  })
}

/** Advance one driver by a small step, turning gently and staying in-box. */
function advance(d: SimDriver): SimDriver {
  // Gentle random turn so paths look organic, not robotic.
  const heading = (d.heading + (Math.random() - 0.5) * 40 + 360) % 360
  const rad = (heading * Math.PI) / 180
  const step = 0.0016 // ~150 m per tick
  let lat = d.lat + Math.cos(rad) * step
  let lng = d.lng + Math.sin(rad) * step

  // Bounce back toward the center if a driver wanders out of the service box.
  let nextHeading = heading
  if (Math.abs(lat - CITY_CENTER.lat) > ROAM_RADIUS_DEG || Math.abs(lng - CITY_CENTER.lng) > ROAM_RADIUS_DEG) {
    nextHeading = (heading + 180) % 360
    lat = d.lat
    lng = d.lng
  }

  return {
    ...d,
    lat,
    lng,
    heading: nextHeading,
    speed: Math.max(0, Math.min(90, d.speed + Math.floor((Math.random() - 0.5) * 10))),
  }
}

function toDto(d: SimDriver): DriverTrackingDto {
  return {
    driverId: d.driverId,
    code: d.code,
    name: d.name,
    driverName: d.name,
    locationPoint: { latitude: d.lat, longitude: d.lng, angle: d.heading },
    status: d.status,
    speed: d.speed,
    heading: d.heading,
    isWork: d.status === "busy",
    timestamp: Date.now(),
  }
}

export class MockSignalRConnection extends SignalRConnection {
  private simTimer: ReturnType<typeof setInterval> | null = null
  private drivers: SimDriver[] = []

  private get self(): SignalRInternal {
    return this as unknown as SignalRInternal
  }

  override async connect(): Promise<void> {
    if (this.isConnected()) return
    // A non-null sentinel so `isConnected()` (state === connected && connection
    // !== null) passes and `registerDispatcher` has an `.on`/`.off` to call.
    this.self.connection = { on: () => {}, off: () => {} } as unknown as SignalRInternal["connection"]
    this.self.connectionId = "mock-connection"
    this.self.connectedAt = new Date()
    this.self.reconnectAttempts = 0
    this.self.lastError = null
    setConnectionState(this.self, "connected")
    this.startSimulator()
    logger.info("[SignalR:mock] Connected (mock) — synthetic driver tracking active")
  }

  override async disconnect(): Promise<void> {
    this.stopSimulator()
    this.self.connection = null
    this.self.connectionId = null
    this.self.connectedAt = null
    setConnectionState(this.self, "disconnected")
  }

  override async reconnect(): Promise<void> {
    await this.disconnect()
    await this.connect()
  }

  // Group joins/leaves are no-ops in mock mode — the simulator drives events.
  override async invoke<T = unknown>(method: string, ..._args: unknown[]): Promise<T> {
    logger.debug(`[SignalR:mock] invoke ${method} (no-op)`)
    return undefined as T
  }

  override async send(_method: string, ..._args: unknown[]): Promise<void> {
    /* no-op in mock mode */
  }

  private startSimulator(): void {
    if (this.simTimer) return
    this.drivers = seedDrivers()
    this.simTimer = setInterval(() => this.tick(), TICK_MS)
  }

  private stopSimulator(): void {
    if (this.simTimer) {
      clearInterval(this.simTimer)
      this.simTimer = null
    }
    this.drivers = []
  }

  /** Emit one frame per driver — but only if someone is listening. */
  private tick(): void {
    const handlers = this.self.eventHandlers.get(DRIVER_TRACKING_EVENT)
    if (!handlers || handlers.size === 0) return // nobody watching — skip the work

    this.drivers = this.drivers.map(advance)
    for (const driver of this.drivers) {
      const dto = toDto(driver)
      handlers.forEach(handler => {
        try {
          ;(handler as (data: DriverTrackingDto) => void)(dto)
        } catch (err) {
          logger.error("[SignalR:mock] driver-tracking handler threw", err)
        }
      })
    }
  }
}
