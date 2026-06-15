/**
 * Performance Configuration
 * Centralized settings for optimization strategies
 */

export const PERFORMANCE_CONFIG = {
  // Search/Filter debounce delay (ms)
  searchDebounceMs: 300,

  // Table pagination
  defaultPageSize: 10,
  maxPageSize: 100,

  // Virtualization
  virtualizeThreshold: 100, // Enable virtual scrolling for tables with 100+ rows
  itemHeight: 48, // Height of each table row in pixels

  // Code splitting
  lazyLoadThreshold: 5000, // Lazy load components over 5KB

  // Image optimization
  imageOptimizationEnabled: true,
  imageSizes: {
    thumbnail: 40,
    small: 80,
    medium: 200,
    large: 400,
  },

  // Cache settings
  cacheStrategies: {
    api: {
      ttl: 5 * 60 * 1000, // 5 minutes
      staleWhileRevalidate: true,
    },
    static: {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    },
  },

  // Memory management
  maxComponentsInCache: 50,
  clearCacheIntervalMs: 10 * 60 * 1000, // 10 minutes

  // Rendering optimization
  concurrentRenderingEnabled: true,
  timeSlicingEnabled: true,
  batchUpdatesEnabled: true,
}

/**
 * Get recommended page size based on available memory
 */
export function getOptimalPageSize(): number {
  if (typeof window === "undefined") return PERFORMANCE_CONFIG.defaultPageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memory = (performance as any)?.memory // Non-standard Performance API
  if (!memory) return PERFORMANCE_CONFIG.defaultPageSize

  const percentUsed = memory.usedJSHeapSize / memory.jsHeapSizeLimit
  if (percentUsed > 0.8) {
    return Math.max(5, PERFORMANCE_CONFIG.defaultPageSize / 2)
  }
  if (percentUsed > 0.6) {
    return PERFORMANCE_CONFIG.defaultPageSize
  }

  return Math.min(PERFORMANCE_CONFIG.maxPageSize, PERFORMANCE_CONFIG.defaultPageSize * 2)
}

/**
 * Should enable virtualization based on data size
 */
export function shouldVirtualize(dataLength: number): boolean {
  return dataLength >= PERFORMANCE_CONFIG.virtualizeThreshold
}

/**
 * Get memory usage as percentage
 */
export function getMemoryUsage(): number {
  if (typeof window === "undefined") return 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memory = (performance as any)?.memory // Non-standard Performance API
  if (!memory) return 0

  return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
}
