/**
 * Request Cache Utility
 * LRU cache for API requests to prevent duplicate calls and improve performance
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
}

export class RequestCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private ttl: number // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlSeconds: number = 300) {
    this.maxSize = maxSize
    this.ttl = ttlSeconds * 1000
  }

  /**
   * Get cached data if available and not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    const now = Date.now()
    const age = now - entry.timestamp

    // Check if expired
    if (age > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++

    return entry.data
  }

  /**
   * Store data in cache
   */
  set(key: string, data: T): void {
    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  /**
   * Check if key exists in cache and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    avgAge: number
  } {
    const now = Date.now()
    let totalHits = 0
    let totalAge = 0

    this.cache.forEach(entry => {
      totalHits += entry.hits
      totalAge += now - entry.timestamp
    })

    const size = this.cache.size

    return {
      size,
      maxSize: this.maxSize,
      hitRate: size > 0 ? totalHits / size : 0,
      avgAge: size > 0 ? totalAge / size / 1000 : 0, // in seconds
    }
  }

  /**
   * Evict least recently used entry (lowest hits)
   */
  private evictLRU(): void {
    let minHits = Infinity
    let lruKey: string | null = null

    this.cache.forEach((entry, key) => {
      if (entry.hits < minHits) {
        minHits = entry.hits
        lruKey = key
      }
    })

    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }
}
