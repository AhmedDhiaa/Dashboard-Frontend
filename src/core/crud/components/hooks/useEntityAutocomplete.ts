/**
 * useEntityAutocomplete Hook
 *
 * Handles fetching, caching, and state management for entity autocomplete.
 *
 * Design decisions to prevent infinite loops:
 *   - fetchItemById reads from refs (not state closures) so its reference is stable.
 *   - The value-sync effect tracks "what we last synced" via lastSyncedValue ref,
 *     so it only fires when the external value actually changes — not when selectedItems
 *     changes as a result of our own setSelectedItems call.
 *   - fetchItems only runs when debouncedSearchTerm genuinely changes.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { searchEntityAutocomplete, fetchEntityById } from "@/core/crud/services/entity-autocomplete.service"
import { useDebounce } from "@/shared/hooks"
import { logger } from "@/shared/logger"

export interface EntityItem {
  id: string | number
  name: string
  code?: string
  [key: string]: unknown
}

interface UseEntityAutocompleteOptions {
  entityName: string
  value?: string | number | string[] | number[] | null
  maxResults?: number
  initialValue?: EntityItem | EntityItem[]
  multiple?: boolean
  customEndpoint?: string
  valueKey?: string
  basePath?: string
}

interface UseEntityAutocompleteReturn {
  searchTerm: string
  items: EntityItem[]
  isLoading: boolean
  isLoadingInitial: boolean
  selectedItem: EntityItem | undefined
  selectedItems: EntityItem[]
  error: string | null
  hasSearched: boolean
  debouncedSearchTerm: string
  setSearchTerm: (term: string) => void
  setSelectedItem: (item: EntityItem | undefined) => void
  setSelectedItems: (items: EntityItem[]) => void
  fetchItems: (force?: boolean) => Promise<void>
  fetchItemById: (id: string | number) => Promise<EntityItem | null>
  clearCache: () => void
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

type RawItem = Record<string, unknown>

function toEntityItem(item: RawItem): EntityItem {
  // Priority: explicit display name -> vehicle-specific fields -> user identity fields -> standard labels -> fallback to ID
  const name = (item.name ||
    item.vehicleNumber ||
    item.reference ||
    item.userName ||
    item.fullName ||
    item.title ||
    item.label ||
    String(item.id)) as string

  return {
    id: item.id as string | number,
    name,
    ...item,
  }
}

function localFilter(list: EntityItem[], term: string): EntityItem[] {
  const q = term.toLowerCase()
  return list.filter(item => {
    const fieldsToSearch = [
      item.name,
      item.title,
      item.label,
      item.code,
      item.vehicleNumber,
      item.reference,
      item.userName,
      item.fullName,
      item.vehicleInformationNumber,
    ]

    return fieldsToSearch.some(field => typeof field === "string" && field.toLowerCase().includes(q))
  })
}

function serializeValue(value: UseEntityAutocompleteOptions["value"]): string {
  if (value == null) return ""
  if (Array.isArray(value)) return value.map(String).sort().join(",")
  return String(value)
}

// ─── Hook ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function -- Complex autocomplete hook: caching, debouncing, API integration
export function useEntityAutocomplete({
  entityName,
  value,
  initialValue,
  multiple,
  customEndpoint,
  valueKey = "id",
  basePath,
}: UseEntityAutocompleteOptions): UseEntityAutocompleteReturn {
  const [searchTerm, setSearchTerm] = useState("")
  const [items, setItems] = useState<EntityItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingInitial, setIsLoadingInitial] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedItem, setSelectedItem] = useState<EntityItem | undefined>(
    !multiple && !Array.isArray(initialValue) ? (initialValue as EntityItem) : undefined,
  )
  const [selectedItems, setSelectedItems] = useState<EntityItem[]>(
    multiple && Array.isArray(initialValue) ? (initialValue as EntityItem[]) : [],
  )

  // ── Refs for stable closures (avoid recreating callbacks on every state change) ──
  const searchCache = useRef<Map<string, EntityItem[]>>(new Map())
  const itemCache = useRef<Map<string | number, EntityItem>>(new Map())
  const failedIds = useRef<Set<string | number>>(new Set())
  const isFetchingById = useRef<Set<string | number>>(new Set())
  const isInitialFetchDone = useRef(false)

  // Stable config refs — read inside callbacks to avoid re-creating them
  const entityNameRef = useRef(entityName)
  const customEndpointRef = useRef(customEndpoint)
  const basePathRef = useRef(basePath)
  const valueKeyRef = useRef(valueKey)

  useEffect(() => {
    entityNameRef.current = entityName
  }, [entityName])
  useEffect(() => {
    customEndpointRef.current = customEndpoint
  }, [customEndpoint])
  useEffect(() => {
    basePathRef.current = basePath
  }, [basePath])
  useEffect(() => {
    valueKeyRef.current = valueKey
  }, [valueKey])

  // Track the last value we synced so we don't re-run when selectedItems changes
  const lastSyncedValue = useRef<string>("")

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const searchCacheKey = useMemo(() => {
    if (customEndpoint?.endsWith("/all")) return `${entityName}:all`
    return debouncedSearchTerm ? `${entityName}:${debouncedSearchTerm}` : `${entityName}:all`
  }, [entityName, debouncedSearchTerm, customEndpoint])

  // ── populateCache (mutates ref, no setState) ────────────────────────────

  const populateCacheFromRaw = useCallback((rawItems: RawItem[]) => {
    const vk = valueKeyRef.current
    for (const raw of rawItems) {
      const item = toEntityItem(raw)
      itemCache.current.set(item.id, item)
      const keyVal = raw[vk]
      if (vk && keyVal && keyVal !== item.id) {
        itemCache.current.set(keyVal as string | number, item)
      }
    }
  }, [])

  const fetchItems = useCallback(
    async (force = false) => {
      const en = entityNameRef.current
      const ce = customEndpointRef.current
      const key = searchCacheKey

      if (!force && searchCache.current.has(key)) {
        setItems(searchCache.current.get(key)!)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const allRaw = (await searchEntityAutocomplete({
          entityName: en,
          customEndpoint: ce,
          term: debouncedSearchTerm || undefined,
        })) as RawItem[]

        populateCacheFromRaw(allRaw)

        const display = allRaw.map(toEntityItem)
        const filtered =
          ce?.endsWith("/all") && debouncedSearchTerm ? localFilter(display, debouncedSearchTerm) : display

        searchCache.current.set(key, filtered)
        setItems(filtered)
        setHasSearched(true)
        isInitialFetchDone.current = true
      } catch (err) {
        logger.error(`Failed to fetch ${en} autocomplete`, err)
        setError("Failed to load items")
        setItems([])
      } finally {
        setIsLoading(false)
      }
    },
    [debouncedSearchTerm, searchCacheKey, populateCacheFromRaw],
  )

  // ── fetchItemById Helpers ───────────────────────────────────────────────

  const tryResolveByAll = useCallback(
    async (id: string | number) => {
      if (customEndpointRef.current?.endsWith("/all") && !isInitialFetchDone.current) {
        await fetchItems()
        return itemCache.current.get(id) || itemCache.current.get(String(id)) || null
      }
      return null
    },
    [fetchItems],
  )

  const tryResolveByCode = useCallback(
    async (id: string | number) => {
      const vk = valueKeyRef.current
      const en = entityNameRef.current
      const ce = customEndpointRef.current

      if (vk && vk !== "id" && typeof id === "string" && isNaN(Number(id))) {
        // forceTerm: code-based lookup must send `term=id` even when a
        // customEndpoint is configured, so the backend filter narrows.
        const searchItems = (await searchEntityAutocomplete({
          entityName: en,
          customEndpoint: ce,
          term: id,
          forceTerm: true,
        })) as RawItem[]
        populateCacheFromRaw(searchItems)
        return itemCache.current.get(id) || itemCache.current.get(String(id)) || null
      }
      return null
    },
    [populateCacheFromRaw],
  )

  // ── fetchItemById — stable (reads config from refs, not state) ──────────

  const fetchItemById = useCallback(
    async (id: string | number): Promise<EntityItem | null> => {
      const strId = String(id)

      // 1. Check Cache
      const cached = itemCache.current.get(id) || itemCache.current.get(strId)
      if (cached) return cached

      // 2. Guards
      if (failedIds.current.has(id)) return null
      if (isFetchingById.current.has(id)) return null
      isFetchingById.current.add(id)

      try {
        setIsLoadingInitial(true)

        // 3. Try to resolve via /all if applicable
        const fromAll = await tryResolveByAll(id)
        if (fromAll) return fromAll

        // 4. Try to resolve via code-based search if applicable
        const fromCode = await tryResolveByCode(id)
        if (fromCode) return fromCode

        // 5. Direct ID fetch
        const raw = (await fetchEntityById({
          entityName: entityNameRef.current,
          id,
          customEndpoint: customEndpointRef.current,
          basePath: basePathRef.current,
        })) as RawItem | null

        if (raw) {
          const item = toEntityItem(raw)
          itemCache.current.set(id, item)
          itemCache.current.set(strId, item)
          const vk = valueKeyRef.current
          const keyVal = raw[vk]
          if (vk && keyVal) itemCache.current.set(keyVal as string | number, item)
          return item
        }

        failedIds.current.add(id)
        return null
      } catch (err) {
        logger.error(`Failed to fetch ${entityNameRef.current} by ID ${id}`, err)
        failedIds.current.add(id)
        return null
      } finally {
        isFetchingById.current.delete(id)
        setIsLoadingInitial(false)
      }
    },
    [tryResolveByAll, tryResolveByCode],
  )

  // ── clearCache ──────────────────────────────────────────────────────────

  const clearCache = useCallback(() => {
    searchCache.current.clear()
    itemCache.current.clear()
    failedIds.current.clear()
    isInitialFetchDone.current = false
  }, [])

  // ── Sync external value → selectedItem / selectedItems ──────────────────
  // KEY: we compare against lastSyncedValue ref, NOT against selectedItems state.
  // This prevents the loop: setSelectedItems → selectedItems changes → effect re-runs.

  useEffect(() => {
    const serialized = serializeValue(value)
    if (serialized === lastSyncedValue.current) return
    lastSyncedValue.current = serialized

    if (!value) {
      if (multiple) setSelectedItems([])
      else setSelectedItem(undefined)
      return
    }

    if (multiple && Array.isArray(value)) {
      const ids = (value as (string | number)[]).map(String)
      void Promise.all(ids.map(id => fetchItemById(id).then(item => item ?? { id, name: id }))).then(results =>
        setSelectedItems(results as EntityItem[]),
      )
    } else if (!multiple && !Array.isArray(value)) {
      void fetchItemById(value as string | number).then(item => {
        setSelectedItem(item ?? { id: value as string | number, name: String(value) })
      })
    }
  }, [value, multiple, fetchItemById]) // no selectedItems in deps!

  // ── Search term → fetchItems ────────────────────────────────────────────

  useEffect(() => {
    void fetchItems()
  }, [debouncedSearchTerm, fetchItems])

  return {
    searchTerm,
    items,
    isLoading,
    isLoadingInitial,
    selectedItem,
    selectedItems,
    error,
    hasSearched,
    debouncedSearchTerm,
    setSearchTerm,
    setSelectedItem,
    setSelectedItems,
    fetchItems,
    fetchItemById,
    clearCache,
  }
}
