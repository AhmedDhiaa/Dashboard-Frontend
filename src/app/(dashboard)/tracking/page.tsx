import { TrackingClient } from "./_components/TrackingClient"

/**
 * /tracking — real-time fleet map. Demonstrates the SignalR realtime layer
 * (useDriverTracking) end-to-end; in standalone mock mode a synthetic emitter
 * drives the markers, so it works with no backend. Authenticated route
 * (middleware-gated); no entity permission required.
 */
export default function Page() {
  return <TrackingClient />
}
