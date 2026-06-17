/**
 * Axe accessibility gate for the live-tracking view — the driver list is a
 * grid of interactive buttons (click-to-focus), so it's the a11y-relevant
 * surface. The SignalR hook and the Leaflet provider are stubbed so the test
 * runs in jsdom without a socket or a real map.
 */

import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"

import { ThemeProvider } from "@/ui/theme/ThemeManager"

vi.mock("@/infra/socket", () => ({
  useDriverTracking: () => ({
    isConnected: true,
    driverLocations: new Map([
      [
        "drv-1",
        {
          driverId: "drv-1",
          code: "EMP-0001",
          name: "Ahmed Hassan",
          status: "busy",
          speed: 42,
          heading: 90,
          locationPoint: { latitude: 33.31, longitude: 44.36, angle: 90 },
        },
      ],
      [
        "drv-2",
        {
          driverId: "drv-2",
          code: "EMP-0002",
          name: "Sara Kareem",
          status: "available",
          speed: 0,
          heading: 0,
          locationPoint: { latitude: 33.32, longitude: 44.37, angle: 0 },
        },
      ],
    ]),
  }),
}))

// Stub the Leaflet provider so no real map (or `window`-bound leaflet) loads.
vi.mock("@/features/maps/providers/leaflet/LeafletMapProvider", () => ({
  LeafletMapProvider: class {
    async initialize() {}
    createMap() {
      return { destroy() {} }
    }
    createMarker() {
      return { setPosition() {}, setRotation() {}, remove() {} }
    }
    destroy() {}
  },
}))

import LiveTrackingView from "../_components/LiveTrackingView"

const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
  },
}

describe("LiveTrackingView — axe", () => {
  it("renders the fleet map + driver list with zero a11y violations", async () => {
    const { container } = render(
      <ThemeProvider>
        <LiveTrackingView />
      </ThemeProvider>,
    )
    expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations()
  })
})
