"use client"

import { MapPin } from "lucide-react"
import type { GoogleMapsPrediction } from "./types"

export function SuggestionsList({
  suggestions,
  onSelect,
}: {
  suggestions: GoogleMapsPrediction[]
  onSelect: (placeId: string) => void
}) {
  return (
    <div className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-background">
      {suggestions.map(suggestion => (
        <button
          type="button"
          key={suggestion.place_id}
          onClick={() => onSelect(suggestion.place_id)}
          className="w-full text-start px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2 border-b last:border-0"
        >
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{suggestion.structured_formatting.main_text}</p>
            <p className="text-xs text-muted-foreground truncate">{suggestion.structured_formatting.secondary_text}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
