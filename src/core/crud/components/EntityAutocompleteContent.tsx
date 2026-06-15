/**
 * EntityAutocompleteContent Component
 * Extracted from EntityAutocomplete to reduce component complexity
 * Handles the dropdown content and search results
 */

import { Loader2, Check } from "lucide-react"
import { cn } from "@/shared/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/ui/design-system/primitives/command"
import { PopoverContent } from "@/ui/design-system/primitives/popover"
import type { EntityItem } from "./hooks/useEntityAutocomplete"

interface EntityAutocompleteContentProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  items: EntityItem[]
  isLoading: boolean
  error: string | null
  hasSearched: boolean
  selectedItem: EntityItem | undefined
  selectedItems: EntityItem[]
  multiple: boolean
  effectiveSearchPlaceholder: string
  loadingText: string
  noResultsText: string
  searchPlaceholderText: string
  renderItem?: ((item: EntityItem) => React.ReactNode) | undefined
  defaultRenderItem: (item: EntityItem) => React.ReactNode
  onSelect: (item: EntityItem) => void
}

export function EntityAutocompleteContent({
  searchTerm,
  setSearchTerm,
  items,
  isLoading,
  error,
  hasSearched,
  selectedItem,
  selectedItems,
  multiple,
  effectiveSearchPlaceholder,
  loadingText,
  noResultsText,
  searchPlaceholderText,
  renderItem,
  defaultRenderItem,
  onSelect,
}: EntityAutocompleteContentProps) {
  const getEmptyMessage = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin me-2" />
          {loadingText}
        </div>
      )
    }

    if (error) {
      return <div className="text-center py-6 text-destructive text-sm">{error}</div>
    }

    if (hasSearched && items.length === 0) {
      return noResultsText
    }

    return searchPlaceholderText
  }

  return (
    <PopoverContent className="w-full p-0" align="start">
      <Command shouldFilter={false}>
        <CommandInput placeholder={effectiveSearchPlaceholder} value={searchTerm} onValueChange={setSearchTerm} />
        <CommandEmpty>{getEmptyMessage()}</CommandEmpty>
        <CommandGroup className="max-h-64 overflow-auto">
          {items.map(item => {
            const isSelected = multiple ? selectedItems.some(i => i.id === item.id) : selectedItem?.id === item.id

            return (
              <CommandItem key={item.id} value={item.id.toString()} onSelect={() => onSelect(item)}>
                <Check className={cn("me-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                {renderItem ? renderItem(item) : defaultRenderItem(item)}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </Command>
    </PopoverContent>
  )
}
