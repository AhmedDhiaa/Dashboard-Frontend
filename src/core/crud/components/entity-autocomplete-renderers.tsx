/**
 * Default render functions for EntityAutocomplete
 * Extracted to reduce main component lines
 */

import type { EntityItem } from "./hooks/useEntityAutocomplete"

export function defaultRenderSelected(item: EntityItem) {
  return (
    <span className="flex items-center gap-2">
      {item.code && (
        <span className="font-mono text-xs bg-primary-700/10 dark:bg-accent/10 px-2 py-0.5 rounded uppercase">
          {item.code}
        </span>
      )}
      <span className="truncate">{item.name}</span>
    </span>
  )
}

export function defaultRenderItem(item: EntityItem) {
  const foreignName = item.foreignName as string | undefined
  return (
    <span className="flex items-center gap-2 flex-1">
      {item.code && (
        <span className="font-mono text-xs bg-primary-700/10 dark:bg-accent/10 px-2 py-0.5 rounded uppercase">
          {item.code}
        </span>
      )}
      <span className="truncate">{item.name}</span>
      {foreignName && <span className="text-xs text-muted-foreground truncate">({foreignName})</span>}
    </span>
  )
}
