/**
 * Icon Factory - Centralized icon creation with caching
 * Prevents unnecessary icon object recreation for better performance
 */

import type { IconConfig } from "../providers/Provider.interface"

export type ShapeType = "circle" | "square" | "diamond" | "pin"

// interface IconCacheKey {
//     shape: ShapeType
//     fillColor: string
//     strokeColor: string
// }

// Icon cache using composite key
const iconCache = new Map<string, IconConfig>()

/**
 * Generate cache key from icon parameters
 */
function getCacheKey(shape: ShapeType, fillColor: string, strokeColor: string): string {
  return `${shape}:${fillColor}:${strokeColor}`
}

/**
 * Create a shape icon with caching
 * @param shape - Shape type
 * @param fillColor - Fill color (default: #1e40af)
 * @param strokeColor - Stroke color (default: #ffffff)
 * @returns Icon configuration object
 */
export function createShapeIcon(
  shape: ShapeType,
  fillColor: string = "#1e40af",
  strokeColor: string = "#ffffff",
): IconConfig | undefined {
  // Check if google maps is available
  const gmaps = window.google
  if (!gmaps?.maps) {
    return undefined
  }

  // Check cache first
  const cacheKey = getCacheKey(shape, fillColor, strokeColor)
  const cached = iconCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Create new icon based on shape
  let icon: IconConfig

  switch (shape) {
    case "circle":
      icon = {
        path: gmaps.maps.SymbolPath.CIRCLE,
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: 1,
        scale: 4,
      }
      break

    case "square":
      icon = {
        path: "M -4,-4 L 4,-4 L 4,4 L -4,4 Z",
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: 2,
        scale: 1,
      }
      break

    case "diamond":
      icon = {
        path: "M 0,-6 L 6,0 L 0,6 L -6,0 Z",
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: 2,
        scale: 1,
      }
      break

    case "pin":
      icon = {
        path: "M 0,-8 C -2,-8 -4,-6 -4,-4 C -4,-2 0,4 0,4 C 0,4 4,-2 4,-4 C 4,-6 2,-8 0,-8 Z",
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: 2,
        scale: 1,
      }
      break

    default:
      // Default to small circle
      icon = {
        path: google.maps.SymbolPath.CIRCLE.toString(),
        fillColor,
        fillOpacity: 1,
        strokeColor,
        strokeWeight: 2,
        scale: 4,
      }
  }

  // Cache the icon
  iconCache.set(cacheKey, icon)
  return icon
}
