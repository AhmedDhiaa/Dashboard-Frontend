/**
 * Unified Search Control Component
 * Replaces CitySearch and PlaceSearch with a single, configurable component
 * Supports cities, places, addresses, and coordinate search
 */

"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"
import { useMapContext } from "../core/MapContext"
import { useSearchLogic } from "../hooks/useSearchLogic"
import { useGoogleMapsServices } from "./search-control/useGoogleMapsServices"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { useBoundaryPreview } from "./search-control/useBoundaryPreview"
import { usePlaceSelection } from "./search-control/usePlaceSelection"
import { SearchInput } from "./search-control/SearchInput"
import { SuggestionsList } from "./search-control/SuggestionsList"
import { SelectedResultDisplay } from "./search-control/SelectedResultDisplay"
import { POSITION_CLASSES } from "./search-control/utils"
import type { SearchType, SearchResult, SearchControlConfig } from "./search-control/types"

export type { SearchType, ControlPosition, SearchResult, SearchControlConfig } from "./search-control/types"

export function SearchControl({
  map: mapProp,
  types = ["places"],
  placeholder = "Search for a location...",
  position = "top-center",
  onSelect,
  extractBoundaries = true,
  autoFocus = false,
  showBoundaryPreview = true,
  visible = true,
  onClose,
  className,
}: SearchControlConfig) {
  const context = useMapContext()
  const map = mapProp || context.map

  const [searchValue, setSearchValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const { autocompleteService, placesService } = useGoogleMapsServices(map || null)
  const debouncedSearchValue = useDebounce(searchValue, 300)

  const searchTypes = useMemo(() => {
    const typeMap: Record<SearchType, string[]> = {
      cities: ["(cities)"],
      places: ["establishment", "geocode"],
      addresses: ["address"],
      geocode: ["geocode"],
    }
    const allTypes = types.flatMap(type => typeMap[type] || [])

    // Google Places API doesn't allow mixing (cities) with other types
    // If (cities) is present, use only that
    if (allTypes.includes("(cities)")) {
      return ["(cities)"]
    }

    return allTypes
  }, [types])

  const { isSearching, suggestions, handleSearch, clearSuggestions } = useSearchLogic(autocompleteService.current, {
    searchTypes,
    minQueryLength: 3,
    maxResults: 5,
    enableCache: true,
    cacheTTL: 300,
  })
  const { displayBoundaryPreview, clearBoundaryPreview } = useBoundaryPreview(map || null, showBoundaryPreview)
  const { handlePlaceSelect: selectPlace } = usePlaceSelection(
    placesService,
    extractBoundaries,
    displayBoundaryPreview,
    map || null,
    onSelect,
  )

  const handlePlaceSelect = useCallback(
    async (placeId: string) => {
      setShowSuggestions(false)
      const result = await selectPlace(placeId)
      if (result) {
        setSelectedResult(result)
        setSearchValue(result.name)
      }
    },
    [selectPlace],
  )

  const handleClear = useCallback(() => {
    setSearchValue("")
    clearSuggestions()
    setShowSuggestions(false)
    setSelectedResult(null)
    clearBoundaryPreview()
    searchInputRef.current?.focus()
  }, [clearSuggestions, clearBoundaryPreview])

  const handleClose = useCallback(() => {
    handleClear()
    onClose?.()
  }, [handleClear, onClose])

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        if (showSuggestions && suggestions.length > 0 && suggestions[0]?.place_id) {
          await handlePlaceSelect(suggestions[0].place_id)
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
        searchInputRef.current?.blur()
      }
    },
    [showSuggestions, suggestions, handlePlaceSelect],
  )

  useEffect(() => {
    if (visible && autoFocus && searchInputRef.current) {
      searchInputRef.current.focus()
    }
    if (!visible) {
      clearBoundaryPreview()
    }
  }, [visible, autoFocus, clearBoundaryPreview])

  useEffect(() => {
    if (debouncedSearchValue) {
      handleSearch(debouncedSearchValue)
      setShowSuggestions(true)
    } else {
      clearSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0)
  }, [suggestions])

  if (!visible) return null

  return (
    <div className={cn("absolute z-20 w-full max-w-md", POSITION_CLASSES[position], className)}>
      <div className="bg-card rounded-xl shadow-sm border border-border p-2 transition-colors duration-200">
        <SearchInput
          searchValue={searchValue}
          isSearching={isSearching}
          placeholder={placeholder}
          handleClear={handleClear}
          handleKeyDown={handleKeyDown}
          onSearchChange={setSearchValue}
          searchInputRef={searchInputRef}
        />

        {showSuggestions && suggestions.length > 0 && (
          <SuggestionsList suggestions={suggestions} onSelect={handlePlaceSelect} />
        )}

        {selectedResult && <SelectedResultDisplay result={selectedResult} />}
      </div>

      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-card border border-border shadow-sm"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
