/**
 * Safely apply Google-Maps-style `setOptions` to a native map instance.
 *
 * `setOptions` (draggable cursor, gesture handling, etc.) is a Google Maps API.
 * Other providers — e.g. Leaflet/OpenStreetMap — have no such method, so calling
 * it directly throws "nativeMap.setOptions is not a function" when a non-Google
 * provider is active. Feature code that tweaks native map options routes through
 * here so the tweak degrades to a no-op instead of crashing the map.
 */
export function safeSetNativeMapOptions(native: unknown, options: Record<string, unknown>): void {
  const map = native as { setOptions?: (o: Record<string, unknown>) => void } | null | undefined
  if (map && typeof map.setOptions === "function") {
    map.setOptions(options)
  }
}
