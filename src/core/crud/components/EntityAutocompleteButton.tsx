"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * EntityAutocompleteButton Component
 * Extracted from EntityAutocomplete to reduce component complexity
 * Handles the trigger button rendering
 */

import { Loader2, X, ChevronsUpDown } from "lucide-react"
import { cn } from "@/shared/utils"
import { Button } from "@/ui/design-system/primitives/button"
import { PopoverTrigger } from "@/ui/design-system/primitives/popover"
import { useT } from "@/shared/config"
import type { EntityItem } from "./hooks/useEntityAutocomplete"

interface EntityAutocompleteButtonProps {
  open: boolean
  disabled: boolean
  isInitialLoading: boolean
  selectedItem: EntityItem | undefined
  selectedItems: EntityItem[]
  effectivePlaceholder: string
  loadingText: string
  className?: string
  clearable: boolean
  multiple: boolean
  renderSelected?: ((item: EntityItem) => React.ReactNode) | undefined
  defaultRenderSelected: (item: EntityItem) => React.ReactNode
  onClear: (e: React.BaseSyntheticEvent) => void
  onRemove?: (item: EntityItem) => void
  error?: boolean
}

export function EntityAutocompleteButton({
  open,
  disabled,
  isInitialLoading,
  selectedItem,
  selectedItems,
  effectivePlaceholder,
  loadingText,
  className,
  clearable,
  multiple,
  renderSelected,
  defaultRenderSelected,
  onClear,
  onRemove,
  error,
}: EntityAutocompleteButtonProps) {
  const t = useT("crud")
  const isDisabled = disabled || isInitialLoading

  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-invalid={error}
        className={cn("w-full justify-between h-11 px-4 rounded-xl transition-all duration-200", className, {
          "opacity-50": isInitialLoading,
          "border-destructive ring-destructive/20 bg-destructive/5 hover:bg-destructive/10": error,
        })}
        disabled={isDisabled}
      >
        <span className="flex-1 text-start truncate">
          {isInitialLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground me-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText}
            </span>
          ) : multiple && selectedItems.length > 0 ? (
            <div className="flex flex-wrap gap-1 px-1">
              {selectedItems.map(item => (
                <div
                  key={item.id}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full border border-primary/20"
                >
                  <span className="truncate max-w-[100px]">
                    {renderSelected ? renderSelected(item) : defaultRenderSelected(item)}
                  </span>
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-primary/70"
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      onRemove?.(item)
                    }}
                  />
                </div>
              ))}
            </div>
          ) : selectedItem ? (
            renderSelected ? (
              renderSelected(selectedItem)
            ) : (
              defaultRenderSelected(selectedItem)
            )
          ) : (
            effectivePlaceholder
          )}
        </span>
        <div className="flex items-center gap-1 ms-2">
          {clearable && (selectedItem || selectedItems.length > 0) && !isDisabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onClear(e)
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  onClear(e)
                }
              }}
              className="inline-flex items-center justify-center rounded-sm hover:bg-muted p-0.5 transition-colors cursor-pointer"
              aria-label={t("actions.clear_selection")}
            >
              <X className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>
    </PopoverTrigger>
  )
}
