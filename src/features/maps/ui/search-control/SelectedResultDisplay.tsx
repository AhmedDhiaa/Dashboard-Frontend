"use client"

import { MapPin } from "lucide-react"
import type { SearchResult } from "./types"

export function SelectedResultDisplay({ result }: { result: SearchResult }) {
  return (
    <div className="mt-2 bg-accent/50 rounded-md p-3">
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{result.name}</p>
          <p className="text-xs text-muted-foreground truncate">{result.address}</p>
          {result.boundaries && result.boundaries.length > 0 && (
            <p className="mt-1 text-xs text-primary">✓ Boundary displayed ({result.boundaries.length} points)</p>
          )}
        </div>
      </div>
    </div>
  )
}
