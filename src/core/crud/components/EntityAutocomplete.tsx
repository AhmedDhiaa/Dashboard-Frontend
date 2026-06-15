"use client"

import React, { useState } from "react"
import { useT } from "@/shared/config"
import { Popover } from "@/ui/design-system/primitives/popover"
import { useEntityAutocomplete, type EntityItem } from "./hooks/useEntityAutocomplete"
import { EntityAutocompleteButton } from "./EntityAutocompleteButton"
import { EntityAutocompleteContent } from "./EntityAutocompleteContent"
import { defaultRenderSelected, defaultRenderItem } from "./entity-autocomplete-renderers"

export type { EntityItem }

interface EntityAutocompleteProps {
  /**
   * API entity name (e.g., "country", "city", "warehouse")
   * Will be used to construct: /api/app/{entityName}/autocomplete
   */
  entityName: string

  /**
   * Callback when selection changes
   */
  onChange: (
    value: string | number | undefined | (string | number)[],
    items: EntityItem | EntityItem[] | undefined,
  ) => void

  /**
   * Currently selected entity ID (null for no selection)
   */
  value?: string | number | string[] | number[] | null | undefined

  /**
   * Whether to allow multiple selections
   */
  multiple?: boolean | undefined

  /**
   * Placeholder text for the trigger button
   */
  placeholder?: string | undefined

  /**
   * Placeholder text for the search input
   */
  searchPlaceholder?: string | undefined

  /**
   * Whether the component is disabled
   */
  disabled?: boolean | undefined

  /**
   * Additional CSS classes for the trigger button
   */
  className?: string | undefined

  /**
   * Function to render display text for selected item
   * Default: shows code (if exists) + name
   */
  renderSelected?: ((item: EntityItem) => React.ReactNode) | undefined

  /**
   * Function to render each item in the dropdown
   * Default: shows code (if exists) + name + foreignName (if exists)
   */
  renderItem?: ((item: EntityItem) => React.ReactNode) | undefined

  /**
   * Whether to show the clear button when an item is selected
   */
  clearable?: boolean | undefined

  /**
   * Maximum number of items to show in dropdown
   */
  maxResults?: number | undefined

  /**
   * Property to use as the value (default: "id")
   */
  valueKey?: string | undefined

  /**
   * Custom API endpoint URL
   */
  customEndpoint?: string | undefined

  /**
   * Base path for ID fetching (override entityName)
   */
  basePath?: string

  /**
   * Whether the component has a validation error
   */
  error?: boolean
}

// eslint-disable-next-line max-lines-per-function -- UI component: props, hook wiring, and JSX must coexist here
function EntityAutocompleteComponent({
  entityName,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  className,
  renderSelected,
  renderItem,
  clearable = true,
  maxResults = 50,
  multiple = false,
  valueKey = "id",
  customEndpoint,
  basePath,
  error: validationError,
}: EntityAutocompleteProps) {
  const t = useT("common")
  const [open, setOpen] = useState(false)

  // Use custom hook for entity autocomplete logic
  const {
    searchTerm,
    setSearchTerm,
    items,
    isLoading,
    isLoadingInitial,
    selectedItem,
    selectedItems,
    setSelectedItem,
    setSelectedItems,
    error,
    hasSearched,
    fetchItems,
  } = useEntityAutocomplete({
    entityName,
    value,
    maxResults,
    multiple,
    customEndpoint,
    valueKey,
    basePath,
  })

  // Use translation for default placeholders
  const effectivePlaceholder = placeholder || t("placeholders.select")
  const effectiveSearchPlaceholder = searchPlaceholder || t("placeholders.search")

  const { handleSelect, handleClear, handleOpenChange, handleRemove } = useAutocompleteHandlers({
    onChange,
    setSelectedItem,
    setSelectedItems,
    selectedItems,
    setOpen,
    setSearchTerm,
    hasSearched,
    fetchItems,
    multiple,
    valueKey,
    basePath,
  })

  // Show loading state for initial value
  const isInitialLoading = !!(isLoadingInitial && value && !selectedItem)

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <EntityAutocompleteButton
          open={open}
          disabled={disabled}
          isInitialLoading={isInitialLoading}
          selectedItem={selectedItem}
          selectedItems={selectedItems}
          effectivePlaceholder={effectivePlaceholder}
          loadingText={t("loading")}
          className={className}
          clearable={clearable}
          multiple={multiple}
          renderSelected={renderSelected}
          defaultRenderSelected={defaultRenderSelected}
          onClear={handleClear}
          onRemove={handleRemove}
          error={validationError}
        />
        <EntityAutocompleteContent
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          items={items}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          selectedItem={selectedItem}
          selectedItems={selectedItems}
          multiple={multiple}
          effectiveSearchPlaceholder={effectiveSearchPlaceholder}
          loadingText={t("loading")}
          noResultsText={t("noResults")}
          searchPlaceholderText={t("placeholders.search")}
          renderItem={renderItem}
          defaultRenderItem={defaultRenderItem}
          onSelect={handleSelect}
        />
      </Popover>
      {error && !open && (
        <div className="absolute top-full start-0 end-0 mt-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  )
}

// Memoize with custom comparison to prevent unnecessary re-renders
export const EntityAutocomplete = React.memo(EntityAutocompleteComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.entityName === nextProps.entityName &&
    prevProps.value === nextProps.value &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.searchPlaceholder === nextProps.searchPlaceholder &&
    prevProps.className === nextProps.className &&
    prevProps.clearable === nextProps.clearable &&
    prevProps.maxResults === nextProps.maxResults &&
    prevProps.multiple === nextProps.multiple &&
    prevProps.valueKey === nextProps.valueKey &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.renderSelected === nextProps.renderSelected &&
    prevProps.renderItem === nextProps.renderItem &&
    prevProps.error === nextProps.error
  )
})

EntityAutocomplete.displayName = "EntityAutocomplete"

/**
 * Hook to manage autocomplete event handlers
 */
function useAutocompleteHandlers({
  onChange,
  setSelectedItem,
  setSelectedItems,
  selectedItems,
  setOpen,
  setSearchTerm,
  hasSearched,
  fetchItems,
  multiple,
  valueKey,
}: {
  onChange: (
    value: string | number | undefined | (string | number)[],
    items: EntityItem | EntityItem[] | undefined,
  ) => void
  setSelectedItem: (item: EntityItem | undefined) => void
  setSelectedItems: (items: EntityItem[]) => void
  selectedItems: EntityItem[]
  setOpen: (open: boolean) => void
  setSearchTerm: (term: string) => void
  hasSearched: boolean
  fetchItems: () => void
  multiple: boolean
  valueKey: string
  basePath?: string
}) {
  const handleSelect = React.useCallback(
    (item: EntityItem) => {
      if (multiple) {
        const isSelected = selectedItems.some(i => i.id === item.id)
        let newItems: EntityItem[]

        if (isSelected) {
          newItems = selectedItems.filter(i => i.id !== item.id)
        } else {
          newItems = [...selectedItems, item]
        }

        setSelectedItems(newItems)
        onChange(
          newItems.map(i => (i[valueKey] ?? i.id) as string | number),
          newItems,
        )
        // Keep open for multiple selections
      } else {
        setSelectedItem(item)
        onChange((item[valueKey] ?? item.id) as string | number, item)
        setOpen(false)
        setSearchTerm("")
      }
    },
    [onChange, setSearchTerm, setSelectedItem, setSelectedItems, selectedItems, setOpen, multiple, valueKey],
  )

  const handleRemove = React.useCallback(
    (item: EntityItem) => {
      const newItems = selectedItems.filter(i => i.id !== item.id)
      setSelectedItems(newItems)
      onChange(
        newItems.map(i => (i[valueKey] ?? i.id) as string | number),
        newItems,
      )
    },
    [onChange, setSelectedItems, selectedItems, valueKey],
  )

  const handleClear = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      if (multiple) {
        setSelectedItems([])
        onChange([], [])
      } else {
        onChange(undefined, undefined)
      }
      setSearchTerm("")
    },
    [onChange, setSearchTerm, multiple, setSelectedItems],
  )

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen)
      if (newOpen && !hasSearched) {
        fetchItems()
      }
    },
    [hasSearched, fetchItems, setOpen],
  )

  return { handleSelect, handleClear, handleOpenChange, handleRemove }
}
