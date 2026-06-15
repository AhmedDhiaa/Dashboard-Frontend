/**
 * Search Suggestions List Component
 * Memoized for performance optimization
 */

import React from "react"
import { MapPin } from "lucide-react"
import { cn } from "@/shared/utils"
import type { SearchPrediction } from "../hooks/useSearchLogic"

interface SearchSuggestionsProps {
  suggestions: SearchPrediction[]
  visible: boolean
  onSelect: (suggestion: SearchPrediction) => void
  className?: string
}

const SuggestionItem = React.memo<{
  suggestion: SearchPrediction
  onSelect: () => void
}>(({ suggestion, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "w-full px-4 py-3 text-start",
      "hover:bg-accent/50 transition-colors",
      "flex items-start gap-3 group",
    )}
  >
    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 group-hover:text-primary transition-colors" />
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-foreground truncate">{suggestion.structured_formatting.main_text}</p>
      {suggestion.structured_formatting.secondary_text && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {suggestion.structured_formatting.secondary_text}
        </p>
      )}
    </div>
  </button>
))

SuggestionItem.displayName = "SuggestionItem"

export const SearchSuggestions = React.memo<SearchSuggestionsProps>(({ suggestions, visible, onSelect, className }) => {
  if (!visible || suggestions.length === 0) return null

  return (
    <div
      className={cn(
        "absolute top-full start-0 end-0 mt-2 z-50",
        "bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl",
        "max-h-80 overflow-y-auto",
        "divide-y divide-border/50",
        className,
      )}
    >
      {suggestions.map(suggestion => (
        <SuggestionItem key={suggestion.place_id} suggestion={suggestion} onSelect={() => onSelect(suggestion)} />
      ))}
    </div>
  )
})

SearchSuggestions.displayName = "SearchSuggestions"
