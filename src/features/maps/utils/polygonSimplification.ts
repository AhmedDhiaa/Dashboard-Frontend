/**
 * Polygon Simplification Utilities
 * Implements Douglas-Peucker algorithm for reducing polygon complexity
 * while maintaining visual accuracy
 */

import type { Coordinate } from "../types"

/**
 * Detect if a polygon represents a circle or near-circle pattern
 * Circles have consistent distances from center and should not be simplified
 */
function isCircularPattern(boundaries: Coordinate[]): boolean {
  if (boundaries.length < 8) return false // Too few points to be a circle

  // Special case: DrawingFeature generates circles with exactly 64 points
  // These should always be preserved
  if (boundaries.length === 64) return true

  // Calculate centroid
  const centerLat = boundaries.reduce((sum, p) => sum + p.latitude, 0) / boundaries.length
  const centerLng = boundaries.reduce((sum, p) => sum + p.longitude, 0) / boundaries.length

  // Calculate distances from centroid to each point
  const distances = boundaries.map(p => {
    const dLat = p.latitude - centerLat
    const dLng = p.longitude - centerLng
    return Math.sqrt(dLat * dLat + dLng * dLng)
  })

  // Calculate mean and standard deviation
  const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length
  const stdDev = Math.sqrt(variance)

  // If standard deviation is very low relative to mean, it's likely a circle
  // Circles have consistent radius (low variance)
  // Threshold: CV < 0.1 means very consistent distances (circle-like).
  // Relaxed from 0.05 to account for map projection and floating-point rounding.
  const coefficientOfVariation = stdDev / mean
  return coefficientOfVariation < 0.1
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number },
): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat

  // Normalize
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return 0

  const u = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (mag * mag)

  // Find the closest point on the line segment
  let closestLat: number, closestLng: number
  if (u < 0) {
    closestLat = lineStart.lat
    closestLng = lineStart.lng
  } else if (u > 1) {
    closestLat = lineEnd.lat
    closestLng = lineEnd.lng
  } else {
    closestLat = lineStart.lat + u * dy
    closestLng = lineStart.lng + u * dx
  }

  const distLat = point.lat - closestLat
  const distLng = point.lng - closestLng
  return Math.sqrt(distLat * distLat + distLng * distLng)
}

/**
 * Douglas-Peucker algorithm for polygon simplification
 * @param points - Array of coordinate points
 * @param epsilon - Tolerance (lower = more points retained, higher = more simplification)
 * @returns Simplified array of points
 */
function douglasPeucker(
  points: Array<{ lat: number; lng: number }>,
  epsilon: number,
): Array<{ lat: number; lng: number }> {
  if (points.length <= 2) return points

  let maxDistance = 0
  let maxIndex = 0

  const firstPoint = points[0]!
  const lastPoint = points[points.length - 1]!

  // Find the point with maximum distance from the line between first and last
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i]!
    const distance = perpendicularDistance(point, firstPoint, lastPoint)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), epsilon)
    const rightSegment = douglasPeucker(points.slice(maxIndex), epsilon)

    // Combine results (remove duplicate point at maxIndex)
    return [...leftSegment.slice(0, -1), ...rightSegment]
  }

  // Return only endpoints
  return [firstPoint, lastPoint]
}

/**
 * Simplify a polygon boundary using Douglas-Peucker algorithm
 * @param boundaries - Original polygon boundaries
 * @param tolerance - Simplification tolerance (degrees, default: 0.0001 ≈ 11 meters)
 * @returns Simplified boundaries with sequence updated
 */
export function simplifyPolygon(boundaries: Coordinate[], tolerance: number = 0.0001): Coordinate[] {
  if (boundaries.length <= 3) return boundaries

  // Detect and preserve circular patterns (circles, ovals).
  // Circles are already optimal; simplifying them destroys the shape.
  if (isCircularPattern(boundaries)) return boundaries

  // Convert to lat/lng format
  const points = boundaries.map(b => ({
    lat: b.latitude,
    lng: b.longitude,
  }))

  const firstPoint = points[0]!
  const lastPoint = points[points.length - 1]!

  // Add closing point for polygon if not already closed
  const isClosed = firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng
  if (!isClosed) {
    points.push(firstPoint)
  }

  // Apply Douglas-Peucker
  const simplified = douglasPeucker(points, tolerance)

  // Remove closing point if we added it
  if (!isClosed && simplified.length > 1) {
    simplified.pop()
  }

  // Convert back to Coordinate format with updated sequences
  return simplified.map((point, index) => ({
    latitude: point.lat,
    longitude: point.lng,
    sequence: index,
  }))
}

/**
 * Check if polygon simplification would improve performance
 * @param boundaries - Polygon boundaries to check
 * @returns true if simplification recommended
 */
export function shouldSimplify(boundaries: Coordinate[]): boolean {
  if (boundaries.length <= 50) return false // Too few points

  // Don't simplify circular patterns
  if (isCircularPattern(boundaries)) return false

  return true
}

/**
 * Get polygon complexity metrics
 */
export function getPolygonMetrics(boundaries: Coordinate[]): {
  vertexCount: number
  perimeter: number
  avgSegmentLength: number
  needsSimplification: boolean
} {
  const vertexCount = boundaries.length

  let perimeter = 0
  for (let i = 0; i < boundaries.length; i++) {
    const current = boundaries[i]!
    const next = boundaries[(i + 1) % boundaries.length]!

    const dLat = next.latitude - current.latitude
    const dLng = next.longitude - current.longitude
    perimeter += Math.sqrt(dLat * dLat + dLng * dLng)
  }

  const avgSegmentLength = perimeter / vertexCount

  return {
    vertexCount,
    perimeter,
    avgSegmentLength,
    needsSimplification: shouldSimplify(boundaries),
  }
}
