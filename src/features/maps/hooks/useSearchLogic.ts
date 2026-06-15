/**
 * Hook for place search logic with autocomplete
 * Handles search queries and result management with request caching
 */

import { useState, useCallback, useRef, useMemo } from "react"
import { logger } from "@/shared/logger"
import { RequestCache } from "../utils/requestCache"

export interface SearchPrediction {
  place_id: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

interface UseSearchLogicOptions {
  searchTypes?: string[]
  minQueryLength?: number
  maxResults?: number
  /** Enable result caching (default: true) */
  enableCache?: boolean
  /** Cache TTL in seconds (default: 300 = 5 minutes) */
  cacheTTL?: number
}

const DEFAULT_OPTIONS: UseSearchLogicOptions = {
  searchTypes: ["(cities)"],
  minQueryLength: 3,
  maxResults: 5,
  enableCache: true,
  cacheTTL: 300,
}

/**
 * Manages search logic for place autocomplete
 * @param autocompleteService - Google Maps AutocompleteService
 * @param options - Search configuration options
 */
export function useSearchLogic(
  autocompleteService: google.maps.places.AutocompleteService | null,
  options: UseSearchLogicOptions = DEFAULT_OPTIONS,
) {
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchPrediction[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Create cache instance (memoized to persist across renders)
  const cache = useMemo(
    () =>
      new RequestCache<SearchPrediction[]>(
        100, // Max 100 cached queries
        options.cacheTTL || 300,
      ),
    [options.cacheTTL],
  )

  const handleSearch = useCallback(
    async (query: string) => {
      const { minQueryLength = 3, searchTypes = ["(cities)"], maxResults = 5, enableCache = true } = options

      // Validation
      if (!query || query.length < minQueryLength) {
        setSuggestions([])
        return
      }

      if (!autocompleteService) {
        logger.warn("[useSearchLogic] Autocomplete service not ready")
        return
      }

      // Generate cache key
      const cacheKey = `${query.toLowerCase()}|${searchTypes.join(",")}`

      // Check cache first if enabled
      if (enableCache) {
        const cached = cache.get(cacheKey)
        if (cached) {
          logger.debug(`[useSearchLogic] 💾 Cache hit for query: "${query}"`)
          setSuggestions(cached)
          return
        }
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      setIsSearching(true)
      logger.debug(`[useSearchLogic] 🔍 Searching for: "${query}"`)

      try {
        const request: google.maps.places.AutocompletionRequest = {
          input: query,
          types: searchTypes,
        }

        autocompleteService.getPlacePredictions(request, (predictions, status) => {
          setIsSearching(false)

          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const topPredictions = predictions.slice(0, maxResults).map(p => ({
              place_id: p.place_id,
              structured_formatting: {
                main_text: p.structured_formatting.main_text,
                secondary_text: p.structured_formatting.secondary_text || "",
              },
            }))

            setSuggestions(topPredictions)

            // Cache results if enabled
            if (enableCache) {
              cache.set(cacheKey, topPredictions)
              logger.debug(`[useSearchLogic] 💾 Cached ${topPredictions.length} results for: "${query}"`)
            }

            logger.info(`[useSearchLogic] Found ${predictions.length} suggestions (showing ${topPredictions.length})`)
          } else {
            setSuggestions([])
            logger.debug(`[useSearchLogic] No results for: "${query}" (status: ${status})`)
          }
        })
      } catch (error) {
        logger.error("[useSearchLogic] Search failed:", error)
        setIsSearching(false)
        setSuggestions([])
      }
    },
    [autocompleteService, options, cache],
  )

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  const getCacheStats = useCallback(() => {
    return cache.getStats()
  }, [cache])

  const clearCache = useCallback(() => {
    cache.clear()
    logger.info("[useSearchLogic] Cache cleared")
  }, [cache])

  return {
    isSearching,
    suggestions,
    handleSearch,
    clearSuggestions,
    getCacheStats,
    clearCache,
  }
}
