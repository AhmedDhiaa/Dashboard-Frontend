/**
 * Map Theme Styles - Centralized theme styling for Google Maps
 * Extracted from UnifiedMap component for better performance and reusability
 */

export type MapThemeStyle = google.maps.MapTypeStyle[]

/**
 * Dark mode map styles
 */
export function getDarkModeStyles(): MapThemeStyle {
  return [
    { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8b92a8" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#60a5fa" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b7280" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#1e3a28" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#34d399" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#2d3748" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1a202c" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca3af" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#3d4a5c" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2937" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3f4f6" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2d3748" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#60a5fa" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#1e293b" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#3b82f6" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#0f172a" }],
    },
  ]
}

/**
 * Light mode map styles
 */
export function getLightModeStyles(): MapThemeStyle {
  return [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#2563eb" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#757575" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#c8e6c9" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#22c55e" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#e5e7eb" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b7280" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#fef3c7" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#fbbf24" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#1f2937" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#e5e7eb" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#2563eb" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#bfdbfe" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#1e40af" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#eff6ff" }],
    },
  ]
}

// Cache for theme styles to avoid recreation
let cachedDarkStyles: MapThemeStyle | null = null
let cachedLightStyles: MapThemeStyle | null = null

/**
 * Get map styles based on theme mode (with caching)
 * @param isDarkMode - Whether dark mode is active
 * @returns Map theme styles
 */
export function getMapStyles(isDarkMode: boolean): MapThemeStyle {
  if (isDarkMode) {
    if (!cachedDarkStyles) {
      cachedDarkStyles = getDarkModeStyles()
    }
    return cachedDarkStyles
  } else {
    if (!cachedLightStyles) {
      cachedLightStyles = getLightModeStyles()
    }
    return cachedLightStyles
  }
}
